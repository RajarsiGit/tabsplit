const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export const authApi = {
  register: (name, email, password) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  me: () => request("/auth/me"),
  githubLoginUrl: `${BASE_URL}/auth/github`,
};

export const groupsApi = {
  list: () => request("/groups"),
  get: (id) => request(`/groups?id=${id}`),
  create: (data) => request("/groups", { method: "POST", body: JSON.stringify(data) }),
  delete: (id) => request(`/groups?id=${id}`, { method: "DELETE" }),
  addMember: (id, email) =>
    request(`/groups?id=${id}&action=members`, { method: "POST", body: JSON.stringify({ email }) }),
  removeMember: (id, userId) =>
    request(`/groups?id=${id}&action=members&userId=${userId}`, { method: "DELETE" }),
};

export const expensesApi = {
  listForGroup: (groupId) => request(`/expenses?groupId=${groupId}`),
  get: (id) => request(`/expenses?id=${id}`),
  create: (data) => request("/expenses", { method: "POST", body: JSON.stringify(data) }),
  update: (data) => request("/expenses", { method: "PUT", body: JSON.stringify(data) }),
  delete: (id) => request(`/expenses?id=${id}`, { method: "DELETE" }),
};

export const recurringApi = {
  listForGroup: (groupId) => request(`/recurring?groupId=${groupId}`),
  create: (data) => request("/recurring", { method: "POST", body: JSON.stringify(data) }),
  update: (data) => request("/recurring", { method: "PUT", body: JSON.stringify(data) }),
  delete: (id) => request(`/recurring?id=${id}`, { method: "DELETE" }),
};

export const settlementsApi = {
  listForGroup: (groupId) => request(`/settlements?groupId=${groupId}`),
  create: (data) => request("/settlements", { method: "POST", body: JSON.stringify(data) }),
  delete: (id) => request(`/settlements?id=${id}`, { method: "DELETE" }),
};
