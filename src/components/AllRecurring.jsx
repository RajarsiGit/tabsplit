import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { groupsApi, recurringApi } from "../utils/api";
import { formatCurrency } from "../utils/categories";

export default function AllRecurring() {
  const [groups, setGroups] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPaused, setShowPaused] = useState(false);

  function load() {
    setLoading(true);
    groupsApi
      .list()
      .then(async (groupList) => {
        setGroups(groupList);
        const entries = await Promise.all(
          groupList.map((g) =>
            recurringApi
              .listForGroup(g.id)
              .then((rs) => rs.map((r) => ({ ...r, group_name: g.name, currency: g.currency })))
              .catch(() => [])
          )
        );
        setRecurring(entries.flat());
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggleActive(r) {
    setError("");
    try {
      await recurringApi.update({ id: r.id, active: !r.active });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const visible = recurring
    .filter((r) => showPaused || r.active)
    .sort((a, b) => new Date(a.next_occurrence) - new Date(b.next_occurrence));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Recurring expenses</h1>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={showPaused} onChange={(e) => setShowPaused(e.target.checked)} />
          Show paused
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You're not in any groups yet.
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming recurring expenses.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <li
              key={r.id}
              className={`flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between ${
                r.active ? "" : "opacity-60"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {r.description}
                  {!r.active && (
                    <span className="ml-2 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      Paused
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {r.frequency} &middot; {r.category} &middot; paid by {r.paid_by_name} &middot; next on{" "}
                  {r.next_occurrence}
                </p>
                <Link
                  to={`/groups/${r.group_id}`}
                  className="mt-1 inline-block text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {r.group_name}
                </Link>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="font-semibold">{formatCurrency(r.amount, r.currency)}</span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(r)}
                  className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {r.active ? "Pause" : "Resume"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
