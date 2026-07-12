import { getDb, requireAuth, setCors, requireGroupMember } from "./_lib/db.js";

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

    // GET /api/recurring?groupId=X - list recurring templates for a group
    if (req.method === "GET" && groupId) {
      await requireGroupMember(sql, groupId, userId);

      const recurring = await sql`
        SELECT r.*, u.name AS paid_by_name
        FROM recurring_expenses r
        JOIN users u ON u.id = r.paid_by
        WHERE r.group_id = ${groupId}
        ORDER BY r.next_occurrence ASC
      `;

      return res.status(200).json(recurring);
    }

    // POST /api/recurring - create a recurring expense template
    // Splits equally among all current group members whenever it's generated.
    if (req.method === "POST") {
      const { groupId: bodyGroupId, description, amount, category, frequency, startDate, paidBy, endDate } = req.body;

      if (!bodyGroupId || !description || !amount || !paidBy || !startDate) {
        return res.status(400).json({
          error: "groupId, description, amount, paidBy, and startDate are required",
        });
      }

      await requireGroupMember(sql, bodyGroupId, userId);

      const result = await sql`
        INSERT INTO recurring_expenses (group_id, created_by, paid_by, description, amount, category, frequency, next_occurrence, end_date)
        VALUES (${bodyGroupId}, ${userId}, ${paidBy}, ${description}, ${amount}, ${category || "other"}, ${frequency || "monthly"}, ${startDate}, ${endDate || null})
        RETURNING *
      `;

      return res.status(201).json(result[0]);
    }

    // PUT /api/recurring - update a recurring template
    if (req.method === "PUT") {
      const { id: bodyId, description, amount, category, frequency, paidBy, active, endDate } = req.body;

      if (!bodyId) {
        return res.status(400).json({ error: "Recurring expense id is required" });
      }

      const existing = await sql`SELECT * FROM recurring_expenses WHERE id = ${bodyId}`;
      if (existing.length === 0) {
        return res.status(404).json({ error: "Recurring expense not found" });
      }

      await requireGroupMember(sql, existing[0].group_id, userId);

      const result = await sql`
        UPDATE recurring_expenses
        SET
          description = COALESCE(${description}, description),
          amount = COALESCE(${amount}, amount),
          category = COALESCE(${category}, category),
          frequency = COALESCE(${frequency}, frequency),
          paid_by = COALESCE(${paidBy}, paid_by),
          active = COALESCE(${active}, active),
          end_date = COALESCE(${endDate}, end_date)
        WHERE id = ${bodyId}
        RETURNING *
      `;

      return res.status(200).json(result[0]);
    }

    // DELETE /api/recurring?id=X
    if (req.method === "DELETE" && id) {
      const existing = await sql`SELECT * FROM recurring_expenses WHERE id = ${id}`;
      if (existing.length === 0) {
        return res.status(404).json({ error: "Recurring expense not found" });
      }

      await requireGroupMember(sql, existing[0].group_id, userId);

      await sql`DELETE FROM recurring_expenses WHERE id = ${id}`;

      return res.status(200).json({ message: "Recurring expense deleted", id: Number(id) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error.message === "Not a member of this group") {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
}
