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
  updateProfile: (name) => request("/auth/profile", { method: "PUT", body: JSON.stringify({ name }) }),
  updatePassword: (currentPassword, newPassword) =>
    request("/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) }),
  unlinkGithub: () => request("/auth/github/unlink", { method: "POST" }),
  githubLoginUrl: `${BASE_URL}/auth/github`,
};

export const groupsApi = {
  list: (includeArchived) => request(`/groups${includeArchived ? "?includeArchived=true" : ""}`),
  get: (id) => request(`/groups?id=${id}`),
  create: (data) => request("/groups", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request("/groups", { method: "PUT", body: JSON.stringify({ id, ...data }) }),
  delete: (id) => request(`/groups?id=${id}`, { method: "DELETE" }),
  setArchived: (id, archived) =>
    request(`/groups?id=${id}&action=archive`, { method: "POST", body: JSON.stringify({ archived }) }),
  listCategories: (id) => request(`/groups?id=${id}&action=categories`),
  addCategory: (id, name) =>
    request(`/groups?id=${id}&action=categories`, { method: "POST", body: JSON.stringify({ name }) }),
  removeCategory: (id, name) =>
    request(`/groups?id=${id}&action=categories&name=${encodeURIComponent(name)}`, { method: "DELETE" }),
  listBudgets: (id) => request(`/groups?id=${id}&action=budgets`),
  createBudget: (id, data) =>
    request(`/groups?id=${id}&action=budgets`, { method: "POST", body: JSON.stringify(data) }),
  updateBudget: (id, budgetId, data) =>
    request(`/groups?id=${id}&action=budgets`, { method: "PUT", body: JSON.stringify({ budgetId, ...data }) }),
  deleteBudget: (id, budgetId) =>
    request(`/groups?id=${id}&action=budgets&budgetId=${budgetId}`, { method: "DELETE" }),
  addMember: (id, email) =>
    request(`/groups?id=${id}&action=members`, { method: "POST", body: JSON.stringify({ email }) }),
  removeMember: (id, userId) =>
    request(`/groups?id=${id}&action=members&userId=${userId}`, { method: "DELETE" }),
  updateMemberRole: (id, userId, role) =>
    request(`/groups?id=${id}&action=members&userId=${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
};

export const accountApi = {
  delete: (mode) => request("/account", { method: "DELETE", body: JSON.stringify({ mode }) }),
  exportUrl: `${BASE_URL}/account`,
};

export const expensesApi = {
  listForGroup: (groupId) => request(`/expenses?groupId=${groupId}`),
  get: (id) => request(`/expenses?id=${id}`),
  create: (data) => request("/expenses", { method: "POST", body: JSON.stringify(data) }),
  update: (data) => request("/expenses", { method: "PUT", body: JSON.stringify(data) }),
  delete: (id) => request(`/expenses?id=${id}`, { method: "DELETE" }),
  listComments: (id) => request(`/expenses?id=${id}&action=comments`),
  addComment: (id, body) =>
    request(`/expenses?id=${id}&action=comments`, { method: "POST", body: JSON.stringify({ body }) }),
  deleteComment: (id, commentId) =>
    request(`/expenses?id=${id}&action=comments&commentId=${commentId}`, { method: "DELETE" }),
  exportUrl: (groupId) => `${BASE_URL}/expenses?groupId=${groupId}&action=export`,
  listItems: (id) => request(`/expenses?id=${id}&action=items`),
};

export const recurringApi = {
  listForGroup: (groupId) => request(`/recurring?groupId=${groupId}`),
  create: (data) => request("/recurring", { method: "POST", body: JSON.stringify(data) }),
  update: (data) => request("/recurring", { method: "PUT", body: JSON.stringify(data) }),
  delete: (id) => request(`/recurring?id=${id}`, { method: "DELETE" }),
};

export const invitesApi = {
  get: (groupId) => request(`/invites?groupId=${groupId}`),
  preview: (token) => request(`/invites?token=${token}`),
  accept: (token) => request(`/invites?token=${token}&action=accept`, { method: "POST" }),
  generate: (groupId) => request(`/invites?groupId=${groupId}`, { method: "POST" }),
  revoke: (groupId) => request(`/invites?groupId=${groupId}`, { method: "DELETE" }),
};

export const notificationsApi = {
  list: (limit) => request(`/notifications${limit ? `?limit=${limit}` : ""}`),
  markRead: (id) => request(`/notifications?action=read&id=${id}`, { method: "POST" }),
  markAllRead: () => request("/notifications?action=read-all", { method: "POST" }),
  listForGroup: (groupId, limit) =>
    request(`/notifications?groupId=${groupId}&scope=group${limit ? `&limit=${limit}` : ""}`),
};

export const settlementsApi = {
  listForGroup: (groupId) => request(`/settlements?groupId=${groupId}`),
  create: (data) => request("/settlements", { method: "POST", body: JSON.stringify(data) }),
  delete: (id) => request(`/settlements?id=${id}`, { method: "DELETE" }),
  nudge: (data) => request("/settlements?action=nudge", { method: "POST", body: JSON.stringify(data) }),
};
