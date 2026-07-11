import { getDb, requireAuth, setCors, clearAuthCookie } from "./db.js";

// Groups where userId is the owner and no one else currently holds the owner role there.
async function findSoleOwnedGroupIds(sql, userId) {
  const rows = await sql`
    SELECT gm.group_id
    FROM group_members gm
    WHERE gm.user_id = ${userId} AND gm.role = 'owner'
      AND NOT EXISTS (
        SELECT 1 FROM group_members gm2
        WHERE gm2.group_id = gm.group_id AND gm2.role = 'owner' AND gm2.user_id != ${userId}
      )
  `;
  return rows.map((r) => r.group_id);
}

// Hard-deletes the user. Groups they solely own are deleted outright (everyone's data in
// them goes with it); everything else the user is tied to elsewhere cascades away per the
// ON DELETE CASCADE rules already defined in schema/schema.sql, leaving other groups intact.
async function deleteAssociatedRecords(sql, userId) {
  const soleOwnedGroupIds = await findSoleOwnedGroupIds(sql, userId);
  for (const groupId of soleOwnedGroupIds) {
    await sql`DELETE FROM groups WHERE id = ${groupId}`;
  }
  await sql`DELETE FROM users WHERE id = ${userId}`;
}

// Leaves every group (handing off sole ownership first, or deleting groups the user is the
// only member of) and scrubs the user row in place instead of deleting it, so shared
// expenses/splits/settlements the user was part of keep showing correctly to other members.
async function deleteOwnRecordsOnly(sql, userId) {
  const soleOwnedGroupIds = await findSoleOwnedGroupIds(sql, userId);

  for (const groupId of soleOwnedGroupIds) {
    const nextOwner = await sql`
      SELECT user_id FROM group_members
      WHERE group_id = ${groupId} AND user_id != ${userId}
      ORDER BY joined_at ASC
      LIMIT 1
    `;

    if (nextOwner.length > 0) {
      await sql`
        UPDATE group_members SET role = 'owner'
        WHERE group_id = ${groupId} AND user_id = ${nextOwner[0].user_id}
      `;
    } else {
      await sql`DELETE FROM groups WHERE id = ${groupId}`;
    }
  }

  await sql`DELETE FROM group_members WHERE user_id = ${userId}`;

  const placeholderEmail = `deleted-user-${userId}@tabsplit.invalid`;
  await sql`
    UPDATE users
    SET name = 'Deleted user', email = ${placeholderEmail}, password = NULL, github_id = NULL
    WHERE id = ${userId}
  `;
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
    if (req.method === "GET") {
      const [profile] = await sql`
        SELECT id, name, email, created_at FROM users WHERE id = ${userId}
      `;

      const groups = await sql`
        SELECT g.id, g.name, g.description, g.currency, gm.role, gm.joined_at
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ${userId}
        ORDER BY g.id
      `;

      const expenses = await sql`
        SELECT e.*
        FROM expenses e
        JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = ${userId}
        ORDER BY e.group_id, e.expense_date
      `;

      const expenseSplits = await sql`
        SELECT es.*
        FROM expense_splits es
        JOIN expenses e ON e.id = es.expense_id
        JOIN group_members gm ON gm.group_id = e.group_id AND gm.user_id = ${userId}
        ORDER BY es.expense_id
      `;

      const recurringExpenses = await sql`
        SELECT r.*
        FROM recurring_expenses r
        JOIN group_members gm ON gm.group_id = r.group_id AND gm.user_id = ${userId}
        ORDER BY r.group_id, r.next_occurrence
      `;

      const settlements = await sql`
        SELECT s.*
        FROM settlements s
        JOIN group_members gm ON gm.group_id = s.group_id AND gm.user_id = ${userId}
        ORDER BY s.group_id, s.settled_at
      `;

      res.setHeader("Content-Disposition", 'attachment; filename="tabsplit-export.json"');
      return res.status(200).json({
        exportedAt: new Date().toISOString(),
        profile,
        groups,
        expenses,
        expenseSplits,
        recurringExpenses,
        settlements,
      });
    }

    if (req.method === "DELETE") {
      const { mode } = req.body || {};

      if (mode !== "associated" && mode !== "own") {
        return res.status(400).json({ error: "mode must be 'associated' or 'own'" });
      }

      if (mode === "associated") {
        await deleteAssociatedRecords(sql, userId);
      } else {
        await deleteOwnRecordsOnly(sql, userId);
      }

      clearAuthCookie(res);
      return res.status(200).json({ message: "Account deleted" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
