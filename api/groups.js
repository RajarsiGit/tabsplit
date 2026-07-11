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

    // GET /api/groups - all groups current user belongs to
    if (req.method === "GET") {
      const groups = await sql`
        SELECT g.*, gm.role,
          (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) AS member_count
        FROM groups g
        JOIN group_members gm ON gm.group_id = g.id
        WHERE gm.user_id = ${userId}
        ORDER BY g.created_at DESC
      `;

      return res.status(200).json(groups);
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
