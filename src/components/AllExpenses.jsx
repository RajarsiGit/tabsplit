import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { groupsApi, expensesApi } from "../utils/api";
import { CATEGORIES, formatCurrency } from "../utils/categories";
import { useApp } from "../context/AppContext.jsx";

export default function AllExpenses() {
  const { user } = useApp();
  const [groups, setGroups] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [groupFilter, setGroupFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [payerFilter, setPayerFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    groupsApi
      .list()
      .then(async (groupList) => {
        setGroups(groupList);
        const entries = await Promise.all(
          groupList.map((g) =>
            expensesApi
              .listForGroup(g.id)
              .then((exps) => exps.map((e) => ({ ...e, group_name: g.name, currency: g.currency })))
              .catch(() => [])
          )
        );
        setExpenses(entries.flat());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return expenses
      .filter((e) => groupFilter === "all" || String(e.group_id) === groupFilter)
      .filter((e) => categoryFilter === "all" || e.category === categoryFilter)
      .filter((e) => payerFilter === "all" || (e.payments || []).some((p) => String(p.userId) === String(user.id)))
      .filter((e) => !search || e.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
  }, [expenses, groupFilter, categoryFilter, payerFilter, search, user.id]);

  const totalsByCurrency = useMemo(() => {
    const totals = {};
    for (const e of filtered) {
      totals[e.currency] = (totals[e.currency] || 0) + Number(e.amount);
    }
    return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const categoryOptions = useMemo(() => {
    const extra = [...new Set(expenses.map((e) => e.category))].filter((c) => !CATEGORIES.includes(c));
    return [...CATEGORIES, ...extra.sort()];
  }, [expenses]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">All expenses</h1>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description..."
          className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={String(g.id)}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={payerFilter}
          onChange={(e) => setPayerFilter(e.target.value)}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="all">Paid by anyone</option>
          <option value="me">Paid by me</option>
        </select>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {totalsByCurrency.map(([currency, total]) => (
            <div key={currency} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total ({currency})</p>
              <p className="text-lg font-semibold">{formatCurrency(total, currency)}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No expenses match these filters.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((exp) => (
            <li
              key={exp.id}
              className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{exp.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {exp.expense_date} &middot; {exp.category} &middot; paid by {exp.paid_by_names || "no one"}
                </p>
                <Link
                  to={`/groups/${exp.group_id}`}
                  className="mt-1 inline-block text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {exp.group_name}
                </Link>
              </div>
              <span className="shrink-0 font-semibold sm:text-right">
                {formatCurrency(exp.amount, exp.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
