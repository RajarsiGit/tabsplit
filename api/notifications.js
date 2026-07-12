import { getDb, requireAuth, setCors, requireGroupMember } from "./_lib/db.js";

// Reusable by other handlers (groups.js, expenses.js, settlements.js) to push a
// notification without going through HTTP.
// `read: true` pre-marks a self-logged audit entry as read at insert time, so an
// actor's own action doesn't inflate their unread bell badge/count - it still shows
// up in the Activity history, just not as something demanding attention.
export async function createNotification(sql, { userId, groupId, type, message, read = false }) {
  const readAt = read ? new Date().toISOString() : null;
  await sql`
    INSERT INTO notifications (user_id, group_id, type, message, read_at)
    VALUES (${userId}, ${groupId ?? null}, ${type}, ${message}, ${readAt})
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
    const { action, id, limit, groupId, scope } = req.query;

    // GET /api/notifications?groupId=X&scope=group - shared activity feed for a group
    // (any member can view; reuses `notifications`, collapsing the fan-out duplicates
    // that multi-recipient events produce into one row per event)
    if (req.method === "GET" && groupId && scope === "group") {
      await requireGroupMember(sql, groupId, userId);

      const rowLimit = Math.min(Math.max(Number(limit) || 30, 1), 200);

      const rows = await sql`
        SELECT DISTINCT ON (type, message, created_at) id, type, message, created_at, user_id
        FROM notifications
        WHERE group_id = ${groupId}
        ORDER BY type, message, created_at DESC, id DESC
        LIMIT ${rowLimit}
      `;

      return res.status(200).json(rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    }

    // GET /api/notifications?limit=X - recent notifications + unread count (defaults to 30, capped at 200)
    if (req.method === "GET") {
      const rowLimit = Math.min(Math.max(Number(limit) || 30, 1), 200);

      const notifications = await sql`
        SELECT * FROM notifications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${rowLimit}
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
