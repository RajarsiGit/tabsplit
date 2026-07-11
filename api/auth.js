import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {
  getDb,
  requireAuth,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  setCors,
  parseCookies,
  setOAuthStateCookie,
  clearOAuthStateCookie,
  OAUTH_STATE_COOKIE_NAME,
} from "./db.js";

const GITHUB_USER_AGENT = "TabSplit";

function getGithubRedirectUri(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${req.headers.host}/api/auth/github/callback`;
}

function redirectTo(res, location) {
  res.setHeader("Location", location);
  return res.status(302).end();
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const sql = getDb();

  let path = "";
  if (req.query?.path) {
    path = Array.isArray(req.query.path) ? req.query.path[0] : req.query.path;
  } else if (req.url) {
    const urlMatch = req.url.match(/\/api\/auth\/?(.*)$/);
    if (urlMatch?.[1]) {
      path = urlMatch[1].split("?")[0];
    }
  }

  try {
    if (req.method === "POST" && path === "register") {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing.length > 0) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await sql`
        INSERT INTO users (name, email, password)
        VALUES (${name}, ${email}, ${hashedPassword})
        RETURNING id, name, email, created_at
      `;

      const user = result[0];
      const token = signToken({ userId: user.id, email: user.email });
      setAuthCookie(res, token);

      return res.status(201).json({ user: { ...user, has_password: true, has_github: false } });
    }

    if (req.method === "POST" && path === "login") {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const result = await sql`
        SELECT id, name, email, password, github_id FROM users WHERE email = ${email}
      `;

      if (result.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const user = result[0];
      if (!user.password) {
        return res
          .status(401)
          .json({ error: "This account signs in with GitHub. Use \"Continue with GitHub\" instead." });
      }
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = signToken({ userId: user.id, email: user.email });
      setAuthCookie(res, token);

      return res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          has_password: true,
          has_github: !!user.github_id,
        },
      });
    }

    if (req.method === "POST" && path === "logout") {
      clearAuthCookie(res);
      return res.status(200).json({ message: "Logged out successfully" });
    }

    if (req.method === "GET" && path === "me") {
      let decoded;
      try {
        decoded = requireAuth(req);
      } catch {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const result = await sql`
        SELECT id, name, email, created_at,
          (password IS NOT NULL) AS has_password,
          (github_id IS NOT NULL) AS has_github
        FROM users WHERE id = ${decoded.userId}
      `;

      if (result.length === 0) {
        return res.status(401).json({ error: "User not found" });
      }

      return res.status(200).json({ user: result[0] });
    }

    if (req.method === "PUT" && path === "profile") {
      let decoded;
      try {
        decoded = requireAuth(req);
      } catch {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await sql`
        UPDATE users SET name = ${name.trim()} WHERE id = ${decoded.userId}
        RETURNING id, name, email, created_at,
          (password IS NOT NULL) AS has_password,
          (github_id IS NOT NULL) AS has_github
      `;

      return res.status(200).json({ user: result[0] });
    }

    if (req.method === "PUT" && path === "password") {
      let decoded;
      try {
        decoded = requireAuth(req);
      } catch {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { currentPassword, newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters" });
      }

      const rows = await sql`SELECT password FROM users WHERE id = ${decoded.userId}`;
      const existingHash = rows[0]?.password;

      if (existingHash) {
        if (!currentPassword) {
          return res.status(400).json({ error: "Current password is required" });
        }
        const isValid = await bcrypt.compare(currentPassword, existingHash);
        if (!isValid) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${decoded.userId}`;

      return res.status(200).json({ message: existingHash ? "Password updated" : "Password set" });
    }

    if (req.method === "POST" && path === "github/unlink") {
      let decoded;
      try {
        decoded = requireAuth(req);
      } catch {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const rows = await sql`SELECT password, github_id FROM users WHERE id = ${decoded.userId}`;
      if (!rows[0]?.github_id) {
        return res.status(400).json({ error: "No GitHub account is connected" });
      }
      if (!rows[0].password) {
        return res.status(400).json({ error: "Set a password before disconnecting GitHub" });
      }

      await sql`UPDATE users SET github_id = NULL WHERE id = ${decoded.userId}`;

      return res.status(200).json({ message: "GitHub disconnected" });
    }

    if (req.method === "GET" && path === "github") {
      if (!process.env.GITHUB_CLIENT_ID) {
        return res.status(500).json({ error: "GitHub login is not configured" });
      }

      const state = crypto.randomBytes(16).toString("hex");
      setOAuthStateCookie(res, state);

      const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        redirect_uri: getGithubRedirectUri(req),
        scope: "read:user user:email",
        state,
      });

      return redirectTo(res, `https://github.com/login/oauth/authorize?${params.toString()}`);
    }

    if (req.method === "GET" && path === "github/callback") {
      // If the browser still carries a valid session cookie through the GitHub redirect
      // round-trip, this is a "connect GitHub to my existing account" flow from the Settings
      // page rather than a login/register flow - link instead of finding-or-creating a user.
      let existingAuth = null;
      try {
        existingAuth = requireAuth(req);
      } catch {
        existingAuth = null;
      }
      const failureRedirect = existingAuth ? "/settings?authError=github" : "/?authError=github";

      // Any failure past this point sends the user back to the login screen (or Settings, if
      // linking) with an error flag instead of a raw JSON 500 - this is a browser redirect
      // flow, not a fetch().
      try {
        const { code, state, error: githubError } = req.query;
        const savedState = parseCookies(req)[OAUTH_STATE_COOKIE_NAME];
        clearOAuthStateCookie(res);

        if (githubError || !code || !state || state !== savedState) {
          return redirectTo(res, failureRedirect);
        }

        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: getGithubRedirectUri(req),
          }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
          return redirectTo(res, failureRedirect);
        }

        const ghHeaders = {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": GITHUB_USER_AGENT,
          Accept: "application/vnd.github+json",
        };

        const profileRes = await fetch("https://api.github.com/user", { headers: ghHeaders });
        const profile = await profileRes.json();
        if (!profile?.id) {
          return redirectTo(res, failureRedirect);
        }

        let email = profile.email;
        if (!email) {
          const emailsRes = await fetch("https://api.github.com/user/emails", { headers: ghHeaders });
          const emails = await emailsRes.json();
          const primary = Array.isArray(emails)
            ? emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified)
            : null;
          email = primary?.email;
        }
        if (!email) {
          return redirectTo(
            res,
            existingAuth ? "/settings?authError=github_no_email" : "/?authError=github_no_email"
          );
        }

        const githubId = String(profile.id);
        const name = profile.name || profile.login;

        if (existingAuth) {
          const conflict = await sql`
            SELECT id FROM users WHERE github_id = ${githubId} AND id != ${existingAuth.userId}
          `;
          if (conflict.length > 0) {
            return redirectTo(res, "/settings?authError=github_taken");
          }

          await sql`UPDATE users SET github_id = ${githubId} WHERE id = ${existingAuth.userId}`;
          return redirectTo(res, "/settings?linked=github");
        }

        let userResult = await sql`SELECT id, name, email FROM users WHERE github_id = ${githubId}`;

        if (userResult.length === 0) {
          const byEmail = await sql`SELECT id FROM users WHERE email = ${email}`;
          if (byEmail.length > 0) {
            userResult = await sql`
              UPDATE users SET github_id = ${githubId} WHERE id = ${byEmail[0].id}
              RETURNING id, name, email
            `;
          } else {
            userResult = await sql`
              INSERT INTO users (name, email, password, github_id)
              VALUES (${name}, ${email}, NULL, ${githubId})
              RETURNING id, name, email
            `;
          }
        }

        const user = userResult[0];
        const token = signToken({ userId: user.id, email: user.email });
        setAuthCookie(res, token);

        return redirectTo(res, "/");
      } catch (err) {
        console.error("GitHub OAuth callback failed:", err);
        return redirectTo(res, failureRedirect);
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
