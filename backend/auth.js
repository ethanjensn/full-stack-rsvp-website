import crypto from "crypto";

const SESSION_COOKIE = "__session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Verify a Werkzeug-style password hash.
 * Supports `pbkdf2:sha256:iterations$salt$hash` and `scrypt:n:r:p$salt$hash`.
 */
export async function checkWerkzeugPassword(password, pwhash) {
  const parts = pwhash.split("$");
  if (parts.length !== 3) {
    return false;
  }
  const [method, salt, hashval] = parts;
  const [scheme, ...args] = method.split(":");

  if (scheme === "pbkdf2") {
    const hashName = args[0] || "sha256";
    const iterations = parseInt(args[1], 10) || 600000;
    const derived = await new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, 32, hashName, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString("hex"));
      });
    });
    return safeEqual(derived, hashval);
  }

  if (scheme === "scrypt") {
    const n = args[0] ? parseInt(args[0], 10) : 32768;
    const r = args[1] ? parseInt(args[1], 10) : 8;
    const p = args[2] ? parseInt(args[2], 10) : 1;
    const maxmem = 132 * n * r * p;
    const derived = await new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, { N: n, r, p, maxmem }, (err, key) => {
        if (err) reject(err);
        else resolve(key.toString("hex"));
      });
    });
    return safeEqual(derived, hashval);
  }

  return false;
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

async function hmac(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createSession(secret, data) {
  const payload = btoa(JSON.stringify(data));
  const signature = await hmac(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifySession(secret, cookieValue) {
  if (!cookieValue) {
    return null;
  }
  const sep = cookieValue.indexOf(".");
  if (sep === -1) {
    return null;
  }
  const payload = cookieValue.slice(0, sep);
  const signature = cookieValue.slice(sep + 1);
  const expected = await hmac(secret, payload);
  if (!safeEqual(signature, expected)) {
    return null;
  }
  try {
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function getSessionCookie(request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getSession(request, env) {
  const value = getSessionCookie(request);
  if (!value) return null;
  return verifySession(env.SESSION_SECRET, value);
}

export async function setSessionCookie(headers, env, data) {
  const value = await createSession(env.SESSION_SECRET, data);
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000).toUTCString();
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`
  );
}

export async function clearSessionCookie(headers) {
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

export async function requireAdmin(request, env) {
  const session = await getSession(request, env);
  if (!session || !session.admin) {
    return null;
  }
  return session;
}

export function generateCsrfToken() {
  const bytes = crypto.randomBytes(32);
  return bytes.toString("hex");
}
