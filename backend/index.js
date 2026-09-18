import * as config from "./config.js";
import { getDb, initDb } from "./db.js";
import {
  checkWerkzeugPassword,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  generateCsrfToken,
} from "./auth.js";
import { sendRsvpNotification } from "./email.js";
import {
  validateRsvp,
  buildGoogleCalendarUrl,
  buildIcsCalendar,
  formatDate,
} from "./utils.js";

let dbInitialized = false;

async function ensureDb(sql) {
  if (!dbInitialized) {
    await initDb(sql);
    dbInitialized = true;
  }
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function redirect(request, path, status = 302, extraHeaders = {}) {
  const url = new URL(path, request.url).toString();
  const headers = new Headers({
    Location: url,
    "Content-Type": "text/html; charset=utf-8",
  });
  for (const [key, value] of Object.entries(extraHeaders)) {
    if (key.toLowerCase() === "set-cookie" && Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }
  return new Response(null, { status, headers });
}

async function fetchUser(sql, username) {
  const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
  return rows[0] || null;
}

function mapRsvp(row) {
  return {
    id: row.id,
    created_at: formatDate(row.created_at),
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    attendance: row.attendance,
    party_size: row.party_size,
    guests: JSON.parse(row.guests_json || "[]"),
    song_request: row.song_request,
  };
}

async function fetchRsvps(sql) {
  const rows = await sql`SELECT * FROM rsvps ORDER BY created_at DESC`;
  return rows.map(mapRsvp);
}

async function getAdminRsvps(sql) {
  const rsvps = await fetchRsvps(sql);
  const totalYes = rsvps.filter((r) => r.attendance === "yes");
  const totalNo = rsvps.filter((r) => r.attendance === "no");
  return {
    rsvps,
    total_rsvps: rsvps.length,
    total_yes: totalYes.length,
    total_no: totalNo.length,
    total_guests: totalYes.reduce((sum, r) => sum + r.party_size, 0),
    total_no_guests: totalNo.reduce((sum, r) => sum + r.party_size, 0),
  };
}

async function readJsonOrForm(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await request.json();
    } catch {
      return {};
    }
  }
  const formData = await request.formData();
  const body = {};
  for (const [key, value] of formData.entries()) {
    body[key] = value;
  }
  return body;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const adminPath = env.ADMIN_PATH || "admin";
      const adminBase = `/${adminPath}`;

      if (url.pathname.startsWith("/static/")) {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = url.pathname.slice("/static".length);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }

      if (url.pathname === "/calendar" && request.method === "GET") {
        return Response.redirect(buildGoogleCalendarUrl(config.config), 302);
      }

      if (url.pathname === "/calendar.ics" && request.method === "GET") {
        return new Response(buildIcsCalendar(config.config), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": "attachment; filename=wedding.ics",
          },
        });
      }

      // Public and admin JSON APIs
      if (url.pathname === "/api/config" && request.method === "GET") {
        return jsonResponse({ ...config.config, ADMIN_PATH: adminPath });
      }

      if (url.pathname === "/api/rsvp" && request.method === "POST") {
        const sql = getDb(env);
        await ensureDb(sql);
        const body = await readJsonOrForm(request);
        const formData = new FormData();
        for (const [key, value] of Object.entries(body)) {
          if (key === "guests" && Array.isArray(value)) {
            value.forEach((guest, index) => {
              const idx = index + 2;
              formData.append(`guest${idx}First`, guest.first || "");
              formData.append(`guest${idx}Last`, guest.last || "");
            });
          } else {
            formData.append(key, value);
          }
        }

        const result = validateRsvp(formData);

        if (!result.ok) {
          return jsonResponse(
            { success: false, error: result.error, formData: result.formData },
            400
          );
        }

        const createdAt = new Date().toISOString();
        const guestsJson = JSON.stringify(result.submission.guests);

        await sql`
          INSERT INTO rsvps (
            created_at, first_name, last_name, email, phone,
            attendance, party_size, guests_json, song_request
          )
          VALUES (
            ${createdAt}, ${result.submission.first_name},
            ${result.submission.last_name}, ${result.submission.email},
            ${result.submission.phone}, ${result.submission.attendance},
            ${result.submission.party_size}, ${guestsJson},
            ${result.submission.song_request}
          )
        `;

        ctx.waitUntil(sendRsvpNotification(env, result.submission, result.submission.guests));

        return jsonResponse({ success: true, submission: result.submission });
      }

      if (url.pathname === "/api/admin/session" && request.method === "GET") {
        const session = await requireAdmin(request, env);
        if (!session) {
          return jsonResponse({ authenticated: false }, 401);
        }
        return jsonResponse({ authenticated: true, csrf: session.csrf });
      }

      if (url.pathname === "/api/admin/login" && request.method === "POST") {
        const sql = getDb(env);
        await ensureDb(sql);
        const body = await readJsonOrForm(request);
        const username = (body.username || "").trim();
        const password = body.password || "";

        const user = await fetchUser(sql, username);
        const valid = user && (await checkWerkzeugPassword(password, user.password_hash));

        if (!valid) {
          return jsonResponse(
            { success: false, error: "Invalid username or password." },
            401
          );
        }

        const csrf = generateCsrfToken();
        const responseHeaders = new Headers();
        await setSessionCookie(responseHeaders, env, { admin: true, csrf });

        return jsonResponse(
          { success: true, csrf },
          200,
          {
            "Set-Cookie": responseHeaders.get("Set-Cookie"),
          }
        );
      }

      if (url.pathname === "/api/admin/logout" && request.method === "POST") {
        const responseHeaders = new Headers();
        await clearSessionCookie(responseHeaders);
        return jsonResponse({ success: true }, 200, {
          "Set-Cookie": responseHeaders.get("Set-Cookie"),
        });
      }

      if (url.pathname === "/api/admin/rsvps" && request.method === "GET") {
        const sql = getDb(env);
        await ensureDb(sql);
        const session = await requireAdmin(request, env);
        if (!session) {
          return jsonResponse({ authenticated: false }, 401);
        }

        const data = await getAdminRsvps(sql);
        return jsonResponse({ ...data, csrf_token: session.csrf });
      }

      const deletePattern = new URLPattern({ pathname: "/api/admin/rsvps/:id" });
      const deleteMatch = deletePattern.exec({ pathname: url.pathname });
      if (deleteMatch && request.method === "DELETE") {
        const sql = getDb(env);
        await ensureDb(sql);
        const session = await requireAdmin(request, env);
        if (!session) {
          return jsonResponse({ authenticated: false }, 401);
        }

        const csrfToken = request.headers.get("X-CSRF-Token") || "";
        if (csrfToken !== session.csrf) {
          return jsonResponse({ success: false, error: "Invalid CSRF token" }, 403);
        }

        const id = deleteMatch.pathname.groups.id;
        await sql`DELETE FROM rsvps WHERE id = ${id}`;

        return jsonResponse({ success: true });
      }

      // SPA fallback: serve index.html for all other routes.
      if (request.method === "GET") {
        return env.ASSETS.fetch(new URL("/index.html", request.url));
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse({ error: error.message }, 500);
    }
  },
};
