import nunjucks from "nunjucks/browser/nunjucks";
import { templates } from "./templates-bundle.js";
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

class PrecompiledLoader {
  getSource(name) {
    const obj = templates[name];
    if (!obj) {
      throw new Error(`Template not found: ${name}`);
    }
    return { src: { type: "code", obj }, path: name, noCache: true };
  }
}

const envNunjucks = new nunjucks.Environment(new PrecompiledLoader(), {
  autoescape: true,
  trimBlocks: true,
  lstripBlocks: true,
});

envNunjucks.addFilter("tojson", (value) => {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/'/g, "\\u0027");
});

envNunjucks.addFilter("formatDate", formatDate);

function render(name, context = {}) {
  return envNunjucks.render(name, { ...context, config: config.config });
}

async function ensureDb(sql) {
  if (!dbInitialized) {
    await initDb(sql);
    dbInitialized = true;
  }
}

function htmlResponse(body, status = 200, extraHeaders = {}) {
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" });
  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }
  return new Response(body, { status, headers });
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

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const adminPath = env.ADMIN_PATH || "admin";

      if (url.pathname.startsWith("/static/")) {
        const assetUrl = new URL(request.url);
        assetUrl.pathname = url.pathname.slice("/static".length);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }

      if (url.pathname === "/" && request.method === "GET") {
        return htmlResponse(render("index"));
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

      if (url.pathname === "/rsvp" && request.method === "GET") {
        return htmlResponse(render("rsvp"));
      }

      if (url.pathname === "/submit_rsvp" && request.method === "POST") {
        const sql = getDb(env);
        await ensureDb(sql);
        const formData = await request.formData();
        const result = validateRsvp(formData);

        if (!result.ok) {
          return htmlResponse(
            render("rsvp", {
              error_message: result.error,
              form_data: result.formData,
            }),
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

        return htmlResponse(
          render("submit-rsvp", {
            first_name: result.submission.first_name,
            last_name: result.submission.last_name,
          })
        );
      }

      if (url.pathname === "/qa" && request.method === "GET") {
        return htmlResponse(render("q-and-a"));
      }

      const loginPath = `/${adminPath}/login`;
      const adminBase = `/${adminPath}`;

      if (url.pathname === loginPath && request.method === "GET") {
        return htmlResponse(render("admin-login", { error: null, admin_path: adminPath }));
      }

      if (url.pathname === loginPath && request.method === "POST") {
        const sql = getDb(env);
        await ensureDb(sql);
        const formData = await request.formData();
        const username = (formData.get("username") || "").trim();
        const password = formData.get("password") || "";

        const user = await fetchUser(sql, username);
        const valid = user && (await checkWerkzeugPassword(password, user.password_hash));

        if (!valid) {
          return htmlResponse(
            render("admin-login", {
              error: "Invalid username or password.",
              admin_path: adminPath,
            }),
            401
          );
        }

        const responseHeaders = new Headers();
        await setSessionCookie(responseHeaders, env, { admin: true, csrf: generateCsrfToken() });
        return redirect(request, adminBase, 302, {
          "Set-Cookie": responseHeaders.get("Set-Cookie"),
        });
      }

      if (url.pathname === `${adminBase}/logout` && request.method === "GET") {
        const responseHeaders = new Headers();
        await clearSessionCookie(responseHeaders);
        return redirect(request, loginPath, 302, {
          "Set-Cookie": responseHeaders.get("Set-Cookie"),
        });
      }

      if (url.pathname === adminBase && request.method === "GET") {
        const sql = getDb(env);
        await ensureDb(sql);
        const session = await requireAdmin(request, env);
        if (!session) {
          return redirect(request, loginPath, 302);
        }

        const rows = await sql`SELECT * FROM rsvps ORDER BY created_at DESC`;
        const rsvps = rows.map((row) => ({
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
        }));

        const totalYes = rsvps.filter((r) => r.attendance === "yes");
        const totalNo = rsvps.filter((r) => r.attendance === "no");

        return htmlResponse(
          render("admin", {
            rsvps,
            csrf_token: session.csrf,
            admin_path: adminPath,
            total_rsvps: rsvps.length,
            total_yes: totalYes.length,
            total_no: totalNo.length,
            total_guests: totalYes.reduce((sum, r) => sum + r.party_size, 0),
            total_no_guests: totalNo.reduce((sum, r) => sum + r.party_size, 0),
          })
        );
      }

      const deletePattern = new URLPattern({ pathname: `/${adminPath}/delete/:id` });
      const deleteMatch = deletePattern.exec({ pathname: url.pathname });
      if (deleteMatch && request.method === "POST") {
        const sql = getDb(env);
        await ensureDb(sql);
        const session = await requireAdmin(request, env);
        if (!session) {
          return redirect(request, loginPath, 302);
        }

        const formData = await request.formData();
        const csrfToken = formData.get("csrf_token");
        if (csrfToken !== session.csrf) {
          return new Response("Invalid CSRF token", { status: 403 });
        }

        const id = deleteMatch.pathname.groups.id;
        await sql`DELETE FROM rsvps WHERE id = ${id}`;

        return redirect(request, adminBase, 302);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
    }
  },
};
