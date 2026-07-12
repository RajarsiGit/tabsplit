import { getDb, requireAuth, setCors, requireGroupMember, requireGroupOwner, isSoleOwner } from "./_lib/db.js";
import { computeBalances, simplifyDebts } from "./_lib/balances.js";
import { createNotification } from "./notifications.js";

function isValidCurrency(code) {
  return typeof code === "string" && /^[A-Z]{3}$/.test(code);
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
    const { id, action } = req.query;

    // GET /api/groups?id=X&action=budgets - spending limits for this group
    if (req.method === "GET" && id && action === "budgets") {
      await requireGroupMember(sql, id, userId);

      const budgets = await sql`
        SELECT * FROM budgets WHERE group_id = ${id} ORDER BY category NULLS FIRST, created_at ASC
      `;

      return res.status(200).json(budgets);
    }

    // GET /api/groups?id=X&action=categories - custom categories this group added
    if (req.method === "GET" && id && action === "categories") {
      await requireGroupMember(sql, id, userId);

      const categories = await sql`
        SELECT name FROM group_categories WHERE group_id = ${id} ORDER BY name ASC
      `;

      return res.status(200).json(categories.map((c) => c.name));
    }

    // GET /api/groups?id=X - single group with members and balances
    if (req.method === "GET" && id) {
      await requireGroupMember(sql, id, userId);

      const groups = await sql`SELECT * FROM groups WHERE id = ${id}`;
      if (groups.length === 0) {
        return res.status(404).json({ error: "Group not found" });
      }

      const members = await sql`
        SELECT u.id, u.name, u.email, gm.role, gm.joined_at
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        WHERE gm.group_id = ${id}
        ORDER BY gm.joined_at ASC
      `;

      const balances = await computeBalances(sql, id);
      const settleUp = simplifyDebts(balances);

      return res.status(200).json({
        ...groups[0],
        members,
        balances,
        settleUp,
      });
    }

    // GET /api/groups - all groups current user belongs to, with their own balance in each
    // Archived groups are excluded unless ?includeArchived=true is passed.
    if (req.method === "GET") {
      const includeArchived = req.query.includeArchived === "true";

      const groups = includeArchived
        ? await sql`
            SELECT g.*, gm.role,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
            FROM groups g
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.user_id = ${userId}
            ORDER BY g.created_at DESC
          `
        : await sql`
            SELECT g.*, gm.role,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
            FROM groups g
            JOIN group_members gm ON gm.group_id = g.id
            WHERE gm.user_id = ${userId} AND g.archived_at IS NULL
            ORDER BY g.created_at DESC
          `;

      if (groups.length > 0) {
        const groupIds = groups.map((g) => g.id);

        const [paidRows, owedRows, sentRows, receivedRows] = await Promise.all([
          sql`
            SELECT e.group_id, SUM(ep.amount) AS total
            FROM expense_payments ep
            JOIN expenses e ON e.id = ep.expense_id
            WHERE ep.user_id = ${userId} AND e.group_id = ANY(${groupIds})
            GROUP BY e.group_id
          `,
          sql`
            SELECT e.group_id, SUM(es.share_amount) AS total
            FROM expense_splits es
            JOIN expenses e ON e.id = es.expense_id
            WHERE es.user_id = ${userId} AND e.group_id = ANY(${groupIds})
            GROUP BY e.group_id
          `,
          sql`SELECT group_id, SUM(amount) AS total FROM settlements WHERE from_user = ${userId} AND group_id = ANY(${groupIds}) GROUP BY group_id`,
          sql`SELECT group_id, SUM(amount) AS total FROM settlements WHERE to_user = ${userId} AND group_id = ANY(${groupIds}) GROUP BY group_id`,
        ]);

        const balanceByGroup = {};
        const add = (groupId, amount) => {
          balanceByGroup[groupId] = (balanceByGroup[groupId] || 0) + Number(amount);
        };
        for (const row of paidRows) add(row.group_id, row.total);
        for (const row of owedRows) add(row.group_id, -row.total);
        for (const row of sentRows) add(row.group_id, row.total);
        for (const row of receivedRows) add(row.group_id, -row.total);

        for (const group of groups) {
          group.my_balance = Math.round((balanceByGroup[group.id] || 0) * 100) / 100;
        }
      }

      return res.status(200).json(groups);
    }

    // POST /api/groups?id=X&action=budgets - create or update a spending limit (owner only)
    if (req.method === "POST" && id && action === "budgets") {
      await requireGroupOwner(sql, id, userId);

      const { category, limitAmount } = req.body;
      if (!limitAmount || Number(limitAmount) <= 0) {
        return res.status(400).json({ error: "limitAmount is required and must be positive" });
      }
      const normalizedCategory = category ? String(category).trim().toLowerCase().slice(0, 50) : null;

      // A partial unique index (category IS NULL) backs the whole-group case, which a plain
      // ON CONFLICT (group_id, category) clause can't target - upsert manually instead.
      const existing = normalizedCategory
        ? await sql`SELECT id FROM budgets WHERE group_id = ${id} AND category = ${normalizedCategory}`
        : await sql`SELECT id FROM budgets WHERE group_id = ${id} AND category IS NULL`;

      const result = existing.length
        ? await sql`UPDATE budgets SET limit_amount = ${limitAmount} WHERE id = ${existing[0].id} RETURNING *`
        : await sql`
            INSERT INTO budgets (group_id, category, limit_amount, created_by)
            VALUES (${id}, ${normalizedCategory}, ${limitAmount}, ${userId})
            RETURNING *
          `;

      return res.status(201).json(result[0]);
    }

    // POST /api/groups?id=X&action=categories - add a custom category
    if (req.method === "POST" && id && action === "categories") {
      await requireGroupMember(sql, id, userId);

      const { name } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Category name is required" });
      }

      const normalized = name.trim().toLowerCase().slice(0, 50);

      await sql`
        INSERT INTO group_categories (group_id, name)
        VALUES (${id}, ${normalized})
        ON CONFLICT (group_id, name) DO NOTHING
      `;

      return res.status(201).json({ name: normalized });
    }

    // DELETE /api/groups?id=X&action=categories&name=X - remove a custom category (owner only)
    if (req.method === "DELETE" && id && action === "categories") {
      await requireGroupOwner(sql, id, userId);

      const { name } = req.query;
      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }

      await sql`DELETE FROM group_categories WHERE group_id = ${id} AND name = ${name}`;

      return res.status(200).json({ message: "Category removed" });
    }

    // POST /api/groups?id=X&action=members - add a member by email
    if (req.method === "POST" && id && action === "members") {
      await requireGroupMember(sql, id, userId);

      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const users = await sql`SELECT id, name, email FROM users WHERE email = ${email}`;
      if (users.length === 0) {
        return res.status(404).json({ error: "No user found with that email" });
      }

      const newMember = users[0];

      const existing = await sql`
        SELECT id FROM group_members WHERE group_id = ${id} AND user_id = ${newMember.id}
      `;
      if (existing.length > 0) {
        return res.status(409).json({ error: "User is already a member of this group" });
      }

      await sql`
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (${id}, ${newMember.id}, 'member')
      `;

      const groupForNotify = await sql`SELECT name FROM groups WHERE id = ${id}`;
      await createNotification(sql, {
        userId: newMember.id,
        groupId: id,
        type: "group_added",
        message: `You were added to "${groupForNotify[0].name}"`,
      });

      return res.status(201).json(newMember);
    }

    // POST /api/groups?id=X&action=archive - archive or unarchive a group (owner only)
    if (req.method === "POST" && id && action === "archive") {
      await requireGroupOwner(sql, id, userId);

      const { archived } = req.body;

      const result =
        archived === false
          ? await sql`UPDATE groups SET archived_at = NULL WHERE id = ${id} RETURNING *`
          : await sql`UPDATE groups SET archived_at = CURRENT_TIMESTAMP WHERE id = ${id} RETURNING *`;

      if (result.length === 0) {
        return res.status(404).json({ error: "Group not found" });
      }

      return res.status(200).json(result[0]);
    }

    // POST /api/groups - create a new group
    if (req.method === "POST") {
      const { name, description, currency } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Group name is required" });
      }

      if (currency !== undefined && !isValidCurrency(currency)) {
        return res.status(400).json({ error: "Currency must be a 3-letter code, e.g. INR" });
      }

      const result = await sql`
        INSERT INTO groups (name, description, currency, created_by)
        VALUES (${name}, ${description || null}, ${currency || "INR"}, ${userId})
        RETURNING *
      `;

      const group = result[0];

      await sql`
        INSERT INTO group_members (group_id, user_id, role)
        VALUES (${group.id}, ${userId}, 'owner')
      `;

      return res.status(201).json(group);
    }

    // PUT /api/groups?id=X&action=budgets - update a spending limit's amount (owner only)
    if (req.method === "PUT" && id && action === "budgets") {
      await requireGroupOwner(sql, id, userId);

      const { budgetId, limitAmount } = req.body;
      if (!budgetId || !limitAmount || Number(limitAmount) <= 0) {
        return res.status(400).json({ error: "budgetId and a positive limitAmount are required" });
      }

      const result = await sql`
        UPDATE budgets SET limit_amount = ${limitAmount} WHERE id = ${budgetId} AND group_id = ${id}
        RETURNING *
      `;
      if (result.length === 0) {
        return res.status(404).json({ error: "Budget not found" });
      }

      return res.status(200).json(result[0]);
    }

    // PUT /api/groups - update name/description/currency (owner only)
    if (req.method === "PUT") {
      const { id: bodyId, name, description, currency } = req.body;

      if (!bodyId) {
        return res.status(400).json({ error: "Group id is required" });
      }

      await requireGroupOwner(sql, bodyId, userId);

      if (currency !== undefined && !isValidCurrency(currency)) {
        return res.status(400).json({ error: "Currency must be a 3-letter code, e.g. INR" });
      }

      const result = await sql`
        UPDATE groups
        SET
          name = COALESCE(${name}, name),
          description = COALESCE(${description ?? null}, description),
          currency = COALESCE(${currency}, currency)
        WHERE id = ${bodyId}
        RETURNING *
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: "Group not found" });
      }

      return res.status(200).json(result[0]);
    }

    // PATCH /api/groups?id=X&action=members&userId=Y - change a member's role (owner only)
    if (req.method === "PATCH" && id && action === "members") {
      await requireGroupOwner(sql, id, userId);

      const targetUserId = Number(req.query.userId);
      const { role } = req.body;

      if (!targetUserId) {
        return res.status(400).json({ error: "userId is required" });
      }
      if (role !== "owner" && role !== "member") {
        return res.status(400).json({ error: "role must be 'owner' or 'member'" });
      }
      if (role === "member" && (await isSoleOwner(sql, id, targetUserId))) {
        return res.status(409).json({ error: "Promote another member to owner before demoting the last owner" });
      }

      const result = await sql`
        UPDATE group_members SET role = ${role} WHERE group_id = ${id} AND user_id = ${targetUserId}
        RETURNING user_id, role
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: "Member not found" });
      }

      const groupForNotify = await sql`SELECT name FROM groups WHERE id = ${id}`;
      await createNotification(sql, {
        userId: targetUserId,
        groupId: id,
        type: "role_changed",
        message: `Your role in "${groupForNotify[0].name}" changed to ${role}`,
      });

      return res.status(200).json(result[0]);
    }

    // DELETE /api/groups?id=X&action=members&userId=Y - remove a member
    if (req.method === "DELETE" && id && action === "members") {
      const membership = await requireGroupMember(sql, id, userId);
      const targetUserId = Number(req.query.userId);

      if (!targetUserId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Members can remove themselves; only owners can remove others.
      if (targetUserId !== userId && membership.role !== "owner") {
        return res.status(403).json({ error: "Only the group owner can remove other members" });
      }

      const balances = await computeBalances(sql, id);
      if (Math.abs(balances[targetUserId] || 0) > 0.01) {
        return res.status(409).json({ error: "This member has an outstanding balance and can't be removed yet" });
      }

      const memberCount = await sql`SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = ${id}`;
      if (memberCount[0].count > 1 && (await isSoleOwner(sql, id, targetUserId))) {
        return res.status(409).json({ error: "Promote another member to owner before removing the last owner" });
      }

      const result = await sql`
        DELETE FROM group_members WHERE group_id = ${id} AND user_id = ${targetUserId}
        RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: "Member not found" });
      }

      return res.status(200).json({ message: "Member removed" });
    }

    // DELETE /api/groups?id=X&action=budgets&budgetId=Y - remove a spending limit (owner only)
    if (req.method === "DELETE" && id && action === "budgets") {
      await requireGroupOwner(sql, id, userId);

      const { budgetId } = req.query;
      if (!budgetId) {
        return res.status(400).json({ error: "budgetId is required" });
      }

      await sql`DELETE FROM budgets WHERE id = ${budgetId} AND group_id = ${id}`;

      return res.status(200).json({ message: "Budget removed" });
    }

    // DELETE /api/groups?id=X - delete a group (owner only)
    if (req.method === "DELETE" && id) {
      await requireGroupOwner(sql, id, userId);

      const result = await sql`DELETE FROM groups WHERE id = ${id} RETURNING id`;
      if (result.length === 0) {
        return res.status(404).json({ error: "Group not found" });
      }

      return res.status(200).json({ message: "Group deleted", id: result[0].id });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error.message === "Not a member of this group" || error.message === "Only the group owner can do this") {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
}
