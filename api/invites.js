import { randomBytes } from "node:crypto";
import { getDb, requireAuth, setCors, requireGroupOwner } from "./_lib/db.js";

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
    const { groupId, token, action } = req.query;

    // GET /api/invites?token=X - preview the group behind an invite token
    if (req.method === "GET" && token) {
      const invites = await sql`
        SELECT gi.group_id, g.name, g.description,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
        FROM group_invites gi
        JOIN groups g ON g.id = gi.group_id
        WHERE gi.token = ${token}
      `;

      if (invites.length === 0) {
        return res.status(404).json({ error: "Invite link is invalid or has been revoked" });
      }

      return res.status(200).json(invites[0]);
    }

    // POST /api/invites?token=X&action=accept - join the group behind an invite token
    if (req.method === "POST" && token && action === "accept") {
      const invites = await sql`SELECT group_id FROM group_invites WHERE token = ${token}`;
      if (invites.length === 0) {
        return res.status(404).json({ error: "Invite link is invalid or has been revoked" });
      }

      const targetGroupId = invites[0].group_id;

      const existing = await sql`
        SELECT id FROM group_members WHERE group_id = ${targetGroupId} AND user_id = ${userId}
      `;
      if (existing.length === 0) {
        await sql`
          INSERT INTO group_members (group_id, user_id, role)
          VALUES (${targetGroupId}, ${userId}, 'member')
        `;
      }

      return res.status(200).json({ groupId: targetGroupId });
    }

    // GET /api/invites?groupId=X - fetch the group's current invite token, if any (owner only)
    if (req.method === "GET" && groupId) {
      await requireGroupOwner(sql, groupId, userId);

      const invites = await sql`SELECT token FROM group_invites WHERE group_id = ${groupId}`;
      return res.status(200).json({ token: invites[0]?.token || null });
    }

    // POST /api/invites?groupId=X - generate/regenerate the group's invite link (owner only)
    if (req.method === "POST" && groupId) {
      await requireGroupOwner(sql, groupId, userId);

      const newToken = randomBytes(24).toString("base64url");

      const result = await sql`
        INSERT INTO group_invites (group_id, token, created_by)
        VALUES (${groupId}, ${newToken}, ${userId})
        ON CONFLICT (group_id) DO UPDATE SET token = ${newToken}, created_by = ${userId}, created_at = CURRENT_TIMESTAMP
        RETURNING token
      `;

      return res.status(201).json({ token: result[0].token });
    }

    // DELETE /api/invites?groupId=X - revoke the group's invite link (owner only)
    if (req.method === "DELETE" && groupId) {
      await requireGroupOwner(sql, groupId, userId);

      await sql`DELETE FROM group_invites WHERE group_id = ${groupId}`;

      return res.status(200).json({ message: "Invite link revoked" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    if (error.message === "Not a member of this group" || error.message === "Only the group owner can do this") {
      return res.status(403).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
}
