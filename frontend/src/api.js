const API_BASE = "";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    return { ok: false, status: 0, data: { error: error.message } };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

export async function getConfig() {
  return request("/api/config");
}

export async function submitRsvp(body) {
  return request("/api/rsvp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getAdminSession() {
  return request("/api/admin/session");
}

export async function loginAdmin(body) {
  return request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function logoutAdmin() {
  return request("/api/admin/logout", {
    method: "POST",
  });
}

export async function getRsvps() {
  return request("/api/admin/rsvps");
}

export async function deleteRsvp(id, csrfToken) {
  return request(`/api/admin/rsvps/${id}`, {
    method: "DELETE",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
  });
}
