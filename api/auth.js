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

      return res.status(201).json({ user });
    }

    if (req.method === "POST" && path === "login") {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const result = await sql`
        SELECT id, name, email, password FROM users WHERE email = ${email}
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
        user: { id: user.id, name: user.name, email: user.email },
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
        SELECT id, name, email, created_at FROM users WHERE id = ${decoded.userId}
      `;

      if (result.length === 0) {
        return res.status(401).json({ error: "User not found" });
      }

      return res.status(200).json({ user: result[0] });
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
      // Any failure past this point sends the user back to the login screen with an
      // error flag instead of a raw JSON 500 - this is a browser redirect flow, not a fetch().
      try {
        const { code, state, error: githubError } = req.query;
        const savedState = parseCookies(req)[OAUTH_STATE_COOKIE_NAME];
        clearOAuthStateCookie(res);

        if (githubError || !code || !state || state !== savedState) {
          return redirectTo(res, "/?authError=github");
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
          return redirectTo(res, "/?authError=github");
        }

        const ghHeaders = {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": GITHUB_USER_AGENT,
          Accept: "application/vnd.github+json",
        };

        const profileRes = await fetch("https://api.github.com/user", { headers: ghHeaders });
        const profile = await profileRes.json();
        if (!profile?.id) {
          return redirectTo(res, "/?authError=github");
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
          return redirectTo(res, "/?authError=github_no_email");
        }

        const githubId = String(profile.id);
        const name = profile.name || profile.login;

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
        return redirectTo(res, "/?authError=github");
      }
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
