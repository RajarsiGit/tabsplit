import { getDb, requireAuth, setCors } from "./db.js";

// Reusable by other handlers (groups.js, expenses.js, settlements.js) to push a
// notification without going through HTTP.
export async function createNotification(sql, { userId, groupId, type, message }) {
  await sql`
    INSERT INTO notifications (user_id, group_id, type, message)
    VALUES (${userId}, ${groupId ?? null}, ${type}, ${message})
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
    const { action, id } = req.query;

    // GET /api/notifications - recent notifications + unread count
    if (req.method === "GET") {
      const notifications = await sql`
        SELECT * FROM notifications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 30
      `;

      const unread = await sql`
        SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = ${userId} AND read_at IS NULL
      `;

      return res.status(200).json({ notifications, unreadCount: unread[0].count });
    }

    // POST /api/notifications?action=read&id=X - mark one notification read
    if (req.method === "POST" && action === "read" && id) {
      await sql`
        UPDATE notifications SET read_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND user_id = ${userId} AND read_at IS NULL
      `;
      return res.status(200).json({ message: "Marked as read" });
    }

    // POST /api/notifications?action=read-all - mark all notifications read
    if (req.method === "POST" && action === "read-all") {
      await sql`
        UPDATE notifications SET read_at = CURRENT_TIMESTAMP
        WHERE user_id = ${userId} AND read_at IS NULL
      `;
      return res.status(200).json({ message: "All marked as read" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}
