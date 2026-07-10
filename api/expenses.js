import { getDb, requireAuth, setCors, requireGroupMember } from "./db.js";

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

async function writeSplits(sql, expenseId, splitType, amount, participants) {
  let splits;

  if (splitType === "exact") {
    if (!validateExactSplits(amount, participants)) {
      throw new Error("Split amounts must add up to the total expense amount");
    }
    splits = participants.map((p) => ({ userId: p.userId, shareAmount: Number(p.shareAmount) }));
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
    const { id, groupId } = req.query;

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

      return res.status(200).json({ ...expenses[0], splits });
    }

    // GET /api/expenses?groupId=X - list expenses for a group
    if (req.method === "GET" && groupId) {
      await requireGroupMember(sql, groupId, userId);

      const expenses = await sql`
        SELECT e.*, u.name AS paid_by_name
        FROM expenses e
        JOIN users u ON u.id = e.paid_by
        WHERE e.group_id = ${groupId}
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
        participants,
      } = req.body;

      if (!bodyGroupId || !description || !amount || !paidBy || !participants?.length) {
        return res.status(400).json({
          error: "groupId, description, amount, paidBy, and participants are required",
        });
      }

      await requireGroupMember(sql, bodyGroupId, userId);

      const result = await sql`
        INSERT INTO expenses (group_id, paid_by, created_by, description, amount, category, split_type, expense_date)
        VALUES (${bodyGroupId}, ${paidBy}, ${userId}, ${description}, ${amount}, ${category || "other"}, ${splitType || "equal"}, ${expenseDate || new Date().toISOString().slice(0, 10)})
        RETURNING *
      `;

      const expense = result[0];
      const splits = await writeSplits(sql, expense.id, splitType, Number(amount), participants);

      return res.status(201).json({ ...expense, splits });
    }

    // PUT /api/expenses - update an expense
    if (req.method === "PUT") {
      const { id: bodyId, description, amount, category, splitType, expenseDate, paidBy, participants } = req.body;

      if (!bodyId) {
        return res.status(400).json({ error: "Expense id is required" });
      }

      const existing = await sql`SELECT * FROM expenses WHERE id = ${bodyId}`;
      if (existing.length === 0) {
        return res.status(404).json({ error: "Expense not found" });
      }

      await requireGroupMember(sql, existing[0].group_id, userId);

      const result = await sql`
        UPDATE expenses
        SET
          description = COALESCE(${description}, description),
          amount = COALESCE(${amount}, amount),
          category = COALESCE(${category}, category),
          split_type = COALESCE(${splitType}, split_type),
          expense_date = COALESCE(${expenseDate}, expense_date),
          paid_by = COALESCE(${paidBy}, paid_by)
        WHERE id = ${bodyId}
        RETURNING *
      `;

      const expense = result[0];

      let splits;
      if (participants?.length) {
        splits = await writeSplits(sql, expense.id, expense.split_type, Number(expense.amount), participants);
      } else {
        splits = await sql`SELECT user_id, share_amount FROM expense_splits WHERE expense_id = ${expense.id}`;
      }

      return res.status(200).json({ ...expense, splits });
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
