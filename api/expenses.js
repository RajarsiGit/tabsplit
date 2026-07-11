import { getDb, requireAuth, setCors, requireGroupMember } from "./_lib/db.js";
import { createNotification } from "./notifications.js";

// Splits `amount` across `userIds` as evenly as possible, distributing the
// leftover pennies (from rounding) to the first few participants.
export function splitEqually(amount, userIds) {
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / userIds.length);
  const remainder = cents - base * userIds.length;

  return userIds.map((userId, index) => ({
    userId,
    shareAmount: (base + (index < remainder ? 1 : 0)) / 100,
  }));
}

function validateExactSplits(amount, participants) {
  const total = participants.reduce((sum, p) => sum + Number(p.shareAmount), 0);
  return Math.abs(Math.round(total * 100) - Math.round(amount * 100)) <= 1;
}

// Splits `amount` proportionally by each participant's percentage, distributing
// leftover pennies (from rounding) to the participants with the largest fractional
// remainder first - the standard "largest remainder" apportionment method.
function splitByPercentage(amount, participants) {
  const cents = Math.round(amount * 100);
  const raw = participants.map((p) => (cents * Number(p.percentage)) / 100);
  const base = raw.map(Math.floor);
  const allocated = base.reduce((sum, b) => sum + b, 0);
  const remainder = cents - allocated;

  const order = raw
    .map((r, index) => ({ index, frac: r - base[index] }))
    .sort((a, b) => b.frac - a.frac);

  const centsPerParticipant = [...base];
  for (let k = 0; k < remainder; k++) {
    centsPerParticipant[order[k % order.length].index] += 1;
  }

  return participants.map((p, index) => ({
    userId: p.userId,
    shareAmount: centsPerParticipant[index] / 100,
  }));
}

// Resolves the request's payer info into a normalized [{ userId, amount }] list -
// either an explicit multi-payer `payments` array, or a single `paidBy` payer for
// the full amount (the common case).
function normalizePayments(amount, paidBy, payments) {
  if (payments?.length) {
    return payments.map((p) => ({ userId: p.userId, amount: Number(p.amount) }));
  }
  if (paidBy) {
    return [{ userId: paidBy, amount: Number(amount) }];
  }
  return [];
}

async function writePayments(sql, expenseId, amount, payments) {
  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  if (Math.abs(Math.round(total * 100) - Math.round(amount * 100)) > 1) {
    throw new Error("Payment amounts must add up to the total expense amount");
  }

  await sql`DELETE FROM expense_payments WHERE expense_id = ${expenseId}`;

  for (const payment of payments) {
    await sql`
      INSERT INTO expense_payments (expense_id, user_id, amount)
      VALUES (${expenseId}, ${payment.userId}, ${payment.amount})
    `;
  }

  return payments.map((p) => ({ userId: p.userId, amount: Number(p.amount) }));
}

async function writeSplits(sql, expenseId, splitType, amount, participants) {
  let splits;

  if (splitType === "exact") {
    if (!validateExactSplits(amount, participants)) {
      throw new Error("Split amounts must add up to the total expense amount");
    }
    splits = participants.map((p) => ({ userId: p.userId, shareAmount: Number(p.shareAmount) }));
  } else if (splitType === "percentage") {
    const totalPct = participants.reduce((sum, p) => sum + Number(p.percentage), 0);
    if (Math.abs(totalPct - 100) > 0.5) {
      throw new Error("Percentages must add up to 100");
    }
    splits = splitByPercentage(amount, participants);
  } else {
    splits = splitEqually(
      amount,
      participants.map((p) => p.userId)
    );
  }

  await sql`DELETE FROM expense_splits WHERE expense_id = ${expenseId}`;

  for (const split of splits) {
    await sql`
      INSERT INTO expense_splits (expense_id, user_id, share_amount)
      VALUES (${expenseId}, ${split.userId}, ${split.shareAmount})
    `;
  }

  return splits;
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const sql = getDb();

  let auth;
  try {
    auth = requireAuth(req);
  } catch {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const userId = auth.userId;

  try {
    const { id, groupId, action } = req.query;

    // GET /api/expenses?id=X&action=comments - list comments on an expense
    if (req.method === "GET" && id && action === "comments") {
      const expenses = await sql`SELECT group_id FROM expenses WHERE id = ${id}`;
      if (expenses.length === 0) {
        return res.status(404).json({ error: "Expense not found" });
      }
      await requireGroupMember(sql, expenses[0].group_id, userId);

      const comments = await sql`
        SELECT ec.id, ec.body, ec.created_at, ec.user_id, u.name AS user_name
        FROM expense_comments ec
        JOIN users u ON u.id = ec.user_id
        WHERE ec.expense_id = ${id}
        ORDER BY ec.created_at ASC
      `;

      return res.status(200).json(comments);
    }

    // POST /api/expenses?id=X&action=comments - add a comment to an expense
    if (req.method === "POST" && id && action === "comments") {
      const expenses = await sql`SELECT group_id, description FROM expenses WHERE id = ${id}`;
      if (expenses.length === 0) {
        return res.status(404).json({ error: "Expense not found" });
      }
      await requireGroupMember(sql, expenses[0].group_id, userId);

      const { body } = req.body;
      if (!body || !body.trim()) {
        return res.status(400).json({ error: "Comment body is required" });
      }

      const result = await sql`
        INSERT INTO expense_comments (expense_id, user_id, body)
        VALUES (${id}, ${userId}, ${body.trim().slice(0, 2000)})
        RETURNING id, body, created_at, user_id
      `;

      const [commenter, otherMembers] = await Promise.all([
        sql`SELECT name FROM users WHERE id = ${userId}`,
        sql`SELECT user_id FROM group_members WHERE group_id = ${expenses[0].group_id} AND user_id != ${userId}`,
      ]);
      for (const member of otherMembers) {
        await createNotification(sql, {
          userId: member.user_id,
          groupId: expenses[0].group_id,
          type: "expense_comment",
          message: `${commenter[0].name} commented on "${expenses[0].description}"`,
        });
      }

      return res.status(201).json({ ...result[0], user_name: commenter[0].name });
    }

    // DELETE /api/expenses?id=X&action=comments&commentId=Y - remove your own comment
    if (req.method === "DELETE" && id && action === "comments") {
      const commentId = req.query.commentId;
      const comments = await sql`SELECT expense_id, user_id FROM expense_comments WHERE id = ${commentId}`;
      if (comments.length === 0) {
        return res.status(404).json({ error: "Comment not found" });
      }
      if (String(comments[0].expense_id) !== String(id)) {
        return res.status(400).json({ error: "Comment does not belong to this expense" });
      }
      if (comments[0].user_id !== userId) {
        return res.status(403).json({ error: "You can only remove your own comments" });
      }

      await sql`DELETE FROM expense_comments WHERE id = ${commentId}`;

      return res.status(200).json({ message: "Comment removed" });
    }

    // GET /api/expenses?id=X - single expense with splits
    if (req.method === "GET" && id) {
      const expenses = await sql`SELECT * FROM expenses WHERE id = ${id}`;
      if (expenses.length === 0) {
        return res.status(404).json({ error: "Expense not found" });
      }

      await requireGroupMember(sql, expenses[0].group_id, userId);

      const splits = await sql`
        SELECT es.user_id, es.share_amount, u.name, u.email
        FROM expense_splits es
        JOIN users u ON u.id = es.user_id
        WHERE es.expense_id = ${id}
      `;

      const payments = await sql`
        SELECT ep.user_id, ep.amount, u.name, u.email
        FROM expense_payments ep
        JOIN users u ON u.id = ep.user_id
        WHERE ep.expense_id = ${id}
      `;

      return res.status(200).json({ ...expenses[0], splits, payments });
    }

    // GET /api/expenses?groupId=X - list expenses for a group
    if (req.method === "GET" && groupId) {
      await requireGroupMember(sql, groupId, userId);

      const expenses = await sql`
        SELECT
          e.*,
          COALESCE(string_agg(DISTINCT u.name, ', '), '') AS paid_by_names,
          COALESCE(json_agg(json_build_object('userId', ep.user_id, 'amount', ep.amount)) FILTER (WHERE ep.user_id IS NOT NULL), '[]') AS payments
        FROM expenses e
        LEFT JOIN expense_payments ep ON ep.expense_id = e.id
        LEFT JOIN users u ON u.id = ep.user_id
        WHERE e.group_id = ${groupId}
        GROUP BY e.id
        ORDER BY e.expense_date DESC, e.created_at DESC
      `;

      return res.status(200).json(expenses);
    }

    // POST /api/expenses - create a new expense
    if (req.method === "POST") {
      const {
        groupId: bodyGroupId,
        description,
        amount,
        category,
        splitType,
        expenseDate,
        paidBy,
        payments,
        participants,
        receiptUrl,
      } = req.body;

      const paymentsList = normalizePayments(amount, paidBy, payments);

      if (!bodyGroupId || !description || !amount || !paymentsList.length || !participants?.length) {
        return res.status(400).json({
          error: "groupId, description, amount, paidBy (or payments), and participants are required",
        });
      }

      await requireGroupMember(sql, bodyGroupId, userId);

      const singlePayer = paymentsList.length === 1 ? paymentsList[0].userId : null;

      const result = await sql`
        INSERT INTO expenses (group_id, paid_by, created_by, description, amount, category, split_type, expense_date, receipt_url)
        VALUES (${bodyGroupId}, ${singlePayer}, ${userId}, ${description}, ${amount}, ${category || "other"}, ${splitType || "equal"}, ${expenseDate || new Date().toISOString().slice(0, 10)}, ${receiptUrl || null})
        RETURNING *
      `;

      const expense = result[0];
      const writtenPayments = await writePayments(sql, expense.id, Number(amount), paymentsList);
      const splits = await writeSplits(sql, expense.id, splitType, Number(amount), participants);

      const [creator, otherMembers] = await Promise.all([
        sql`SELECT name FROM users WHERE id = ${userId}`,
        sql`SELECT user_id FROM group_members WHERE group_id = ${bodyGroupId} AND user_id != ${userId}`,
      ]);
      for (const member of otherMembers) {
        await createNotification(sql, {
          userId: member.user_id,
          groupId: bodyGroupId,
          type: "expense_added",
          message: `${creator[0].name} added a new expense: ${description}`,
        });
      }

      return res.status(201).json({ ...expense, splits, payments: writtenPayments });
    }

    // PUT /api/expenses - update an expense
    if (req.method === "PUT") {
      const { id: bodyId, description, amount, category, splitType, expenseDate, paidBy, payments, participants, receiptUrl } = req.body;

      if (!bodyId) {
        return res.status(400).json({ error: "Expense id is required" });
      }

      const existing = await sql`SELECT * FROM expenses WHERE id = ${bodyId}`;
      if (existing.length === 0) {
        return res.status(404).json({ error: "Expense not found" });
      }

      await requireGroupMember(sql, existing[0].group_id, userId);

      const finalAmount = amount !== undefined ? Number(amount) : Number(existing[0].amount);
      const paymentsList = payments?.length || paidBy ? normalizePayments(finalAmount, paidBy, payments) : null;
      const singlePayer = paymentsList
        ? paymentsList.length === 1
          ? paymentsList[0].userId
          : null
        : existing[0].paid_by;

      const result = await sql`
        UPDATE expenses
        SET
          description = COALESCE(${description}, description),
          amount = COALESCE(${amount}, amount),
          category = COALESCE(${category}, category),
          split_type = COALESCE(${splitType}, split_type),
          expense_date = COALESCE(${expenseDate}, expense_date),
          receipt_url = COALESCE(${receiptUrl}, receipt_url),
          paid_by = ${singlePayer}
        WHERE id = ${bodyId}
        RETURNING *
      `;

      const expense = result[0];

      let writtenPayments;
      if (paymentsList) {
        writtenPayments = await writePayments(sql, expense.id, finalAmount, paymentsList);
      } else {
        writtenPayments = await sql`SELECT user_id, amount FROM expense_payments WHERE expense_id = ${expense.id}`;
      }

      let splits;
      if (participants?.length) {
        splits = await writeSplits(sql, expense.id, expense.split_type, Number(expense.amount), participants);
      } else {
        splits = await sql`SELECT user_id, share_amount FROM expense_splits WHERE expense_id = ${expense.id}`;
      }

      return res.status(200).json({ ...expense, splits, payments: writtenPayments });
    }

    // DELETE /api/expenses?id=X
    if (req.method === "DELETE" && id) {
      const existing = await sql`SELECT * FROM expenses WHERE id = ${id}`;
      if (existing.length === 0) {
        return res.status(404).json({ error: "Expense not found" });
      }

      await requireGroupMember(sql, existing[0].group_id, userId);

      await sql`DELETE FROM expenses WHERE id = ${id}`;

      return res.status(200).json({ message: "Expense deleted", id: Number(id) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error.message === "Not a member of this group") {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
}
