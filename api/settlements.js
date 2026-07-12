import { getDb, requireAuth, setCors, requireGroupMember } from "./_lib/db.js";
import { createNotification } from "./notifications.js";
import { formatCurrency } from "./_lib/format.js";

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

    // POST /api/settlements?action=nudge - remind a member they owe a settle-up suggestion
    if (req.method === "POST" && action === "nudge") {
      const { groupId: bodyGroupId, from, to, amount } = req.body;

      if (!bodyGroupId || !from || !to || !amount) {
        return res.status(400).json({ error: "groupId, from, to, and amount are required" });
      }

      await requireGroupMember(sql, bodyGroupId, userId);
      await requireGroupMember(sql, bodyGroupId, from);
      await requireGroupMember(sql, bodyGroupId, to);

      const [group, creditor, debtor] = await Promise.all([
        sql`SELECT name, currency FROM groups WHERE id = ${bodyGroupId}`,
        sql`SELECT name FROM users WHERE id = ${to}`,
        sql`SELECT name FROM users WHERE id = ${from}`,
      ]);

      await createNotification(sql, {
        userId: from,
        groupId: bodyGroupId,
        type: "settle_up_nudge",
        message: `Reminder: you owe ${creditor[0].name} ${formatCurrency(amount, group[0].currency)} in ${group[0].name}`,
      });
      await createNotification(sql, {
        userId,
        groupId: bodyGroupId,
        type: "settle_up_nudge_sent",
        message: `Reminded ${debtor[0].name} about ${formatCurrency(amount, group[0].currency)} owed to ${creditor[0].name}`,
        read: true,
      });

      return res.status(200).json({ message: "Reminder sent" });
    }

    // GET /api/settlements?groupId=X - list settlements for a group
    if (req.method === "GET" && groupId) {
      await requireGroupMember(sql, groupId, userId);

      const settlements = await sql`
        SELECT s.*, fu.name AS from_user_name, tu.name AS to_user_name
        FROM settlements s
        JOIN users fu ON fu.id = s.from_user
        JOIN users tu ON tu.id = s.to_user
        WHERE s.group_id = ${groupId}
        ORDER BY s.settled_at DESC, s.created_at DESC
      `;

      return res.status(200).json(settlements);
    }

    // POST /api/settlements - record a manual settlement ("I paid you back $20")
    if (req.method === "POST") {
      const { groupId: bodyGroupId, fromUser, toUser, amount, note, settledAt } = req.body;

      if (!bodyGroupId || !fromUser || !toUser || !amount) {
        return res.status(400).json({ error: "groupId, fromUser, toUser, and amount are required" });
      }

      if (Number(fromUser) === Number(toUser)) {
        return res.status(400).json({ error: "fromUser and toUser must be different" });
      }

      await requireGroupMember(sql, bodyGroupId, userId);
      await requireGroupMember(sql, bodyGroupId, fromUser);
      await requireGroupMember(sql, bodyGroupId, toUser);

      const result = await sql`
        INSERT INTO settlements (group_id, from_user, to_user, amount, note, settled_at)
        VALUES (${bodyGroupId}, ${fromUser}, ${toUser}, ${amount}, ${note || null}, ${settledAt || new Date().toISOString().slice(0, 10)})
        RETURNING *
      `;

      const actorName = await sql`SELECT name FROM users WHERE id = ${userId}`;
      const counterpartyIds = [fromUser, toUser].filter((u) => Number(u) !== Number(userId));
      for (const counterpartyId of counterpartyIds) {
        await createNotification(sql, {
          userId: counterpartyId,
          groupId: bodyGroupId,
          type: "settlement_recorded",
          message: `${actorName[0].name} recorded a settlement of ${amount}`,
        });
      }
      await createNotification(sql, {
        userId,
        groupId: bodyGroupId,
        type: "settlement_recorded",
        message: `${actorName[0].name} recorded a settlement of ${amount}`,
        read: true,
      });

      return res.status(201).json(result[0]);
    }

    // DELETE /api/settlements?id=X - undo a settlement
    if (req.method === "DELETE" && id) {
      const existing = await sql`SELECT * FROM settlements WHERE id = ${id}`;
      if (existing.length === 0) {
        return res.status(404).json({ error: "Settlement not found" });
      }

      await requireGroupMember(sql, existing[0].group_id, userId);

      await sql`DELETE FROM settlements WHERE id = ${id}`;

      const [actor, fromUser, toUser] = await Promise.all([
        sql`SELECT name FROM users WHERE id = ${userId}`,
        sql`SELECT name FROM users WHERE id = ${existing[0].from_user}`,
        sql`SELECT name FROM users WHERE id = ${existing[0].to_user}`,
      ]);
      await createNotification(sql, {
        userId,
        groupId: existing[0].group_id,
        type: "settlement_removed",
        message: `${actor[0].name} removed a settlement between ${fromUser[0].name} and ${toUser[0].name}`,
        read: true,
      });

      return res.status(200).json({ message: "Settlement removed", id: Number(id) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error.message === "Not a member of this group") {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
}
