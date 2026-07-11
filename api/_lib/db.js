import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";

let sql;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
export const COOKIE_NAME = "auth_token";

export function getDb() {
  if (!sql) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    sql = neon(databaseUrl);
  }

  return sql;
}

export function parseCookies(req) {
  return (
    req.headers.cookie?.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      acc[key] = value;
      return acc;
    }, {}) || {}
  );
}

// Adds a Set-Cookie header without clobbering one already set on this response
// (e.g. the callback route sets the auth cookie and clears the OAuth state cookie together).
function appendSetCookie(res, cookieStr) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieStr);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieStr]);
  } else {
    res.setHeader("Set-Cookie", [existing, cookieStr]);
  }
}

export const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";

export function setOAuthStateCookie(res, state) {
  appendSetCookie(
    res,
    `${OAUTH_STATE_COOKIE_NAME}=${state}; HttpOnly; Path=/; Max-Age=300; SameSite=Lax`
  );
}

export function clearOAuthStateCookie(res) {
  appendSetCookie(
    res,
    `${OAUTH_STATE_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

// Verifies the JWT cookie and returns { userId, email }. Throws on missing/invalid token.
export function requireAuth(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new Error("Invalid or expired token");
  }
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function setAuthCookie(res, token) {
  appendSetCookie(
    res,
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=None; Secure`
  );
}

export function clearAuthCookie(res) {
  appendSetCookie(
    res,
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure`
  );
}

export function setCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
}

// Throws if the user is not a member of the group.
export async function requireGroupMember(sql, groupId, userId) {
  const rows = await sql`
    SELECT role FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  if (rows.length === 0) {
    throw new Error("Not a member of this group");
  }
  return rows[0];
}

// Throws if the user is not the group's owner.
export async function requireGroupOwner(sql, groupId, userId) {
  const membership = await requireGroupMember(sql, groupId, userId);
  if (membership.role !== "owner") {
    throw new Error("Only the group owner can do this");
  }
  return membership;
}

// True if userId is an owner of the group and no other member holds the owner role.
export async function isSoleOwner(sql, groupId, userId) {
  const rows = await sql`
    SELECT user_id FROM group_members WHERE group_id = ${groupId} AND role = 'owner'
  `;
  return rows.length === 1 && rows[0].user_id === Number(userId);
}
