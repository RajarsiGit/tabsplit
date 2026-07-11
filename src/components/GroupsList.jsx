import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { groupsApi, expensesApi } from "../utils/api";
import { CURRENCIES } from "../utils/currencies";
import Dashboard from "./Dashboard.jsx";

export default function GroupsList() {
  const [groups, setGroups] = useState([]);
  const [expensesByGroup, setExpensesByGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    loadGroups();
  }, []);

  function loadGroups() {
    setLoading(true);
    groupsApi
      .list()
      .then(async (data) => {
        setGroups(data);
        const entries = await Promise.all(
          data.map((g) => expensesApi.listForGroup(g.id).then((exps) => [g.id, exps]).catch(() => [g.id, []]))
        );
        setExpensesByGroup(Object.fromEntries(entries));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await groupsApi.create({ name, description, currency });
      setName("");
      setDescription("");
      setCurrency("INR");
      setShowForm(false);
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(e, groupId) {
    e.preventDefault();
    e.stopPropagation();

    if (confirmingId !== groupId) {
      setConfirmingId(groupId);
      return;
    }

    setError("");
    try {
      await groupsApi.delete(groupId);
      setConfirmingId(null);
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Your groups</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "New group"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div>
            <label htmlFor="group-name" className="mb-1 block text-sm font-medium text-gray-700">
              Group name
            </label>
            <input
              id="group-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apartment 4B, Italy Trip"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="group-description" className="mb-1 block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <input
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="group-currency" className="mb-1 block text-sm font-medium text-gray-700">
              Currency
            </label>
            <select
              id="group-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Create group
          </button>
        </form>
      )}

      {!loading && <Dashboard groups={groups} expensesByGroup={expensesByGroup} />}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500">
          No groups yet. Create one to start splitting expenses.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                to={`/groups/${group.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 truncate font-semibold">{group.name}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {group.member_count} member{group.member_count === "1" ? "" : "s"}
                    </span>
                    {group.role === "owner" && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, group.id)}
                        onBlur={() => setConfirmingId(null)}
                        aria-label={`Delete group ${group.name}`}
                        className="text-xs font-medium text-red-500 hover:underline"
                      >
                        {confirmingId === group.id ? "Confirm delete?" : "Delete"}
                      </button>
                    )}
                  </div>
                </div>
                {group.description && (
                  <p className="mt-1 text-sm text-gray-500">{group.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
