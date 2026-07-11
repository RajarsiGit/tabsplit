import { useCallback, useEffect, useState } from "react";
import { groupsApi } from "../utils/api";
import { formatCurrency } from "../utils/categories";
import SettleUpForm from "./SettleUpForm.jsx";

function memberName(members, id) {
  return members.find((m) => m.id === Number(id))?.name ?? "Unknown";
}

export default function SettleUp() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeForm, setActiveForm] = useState(null); // { groupId, prefill }

  const load = useCallback(() => {
    setLoading(true);
    groupsApi
      .list()
      .then(async (groupList) => {
        const full = await Promise.all(
          groupList.map((g) => groupsApi.get(g.id).catch(() => null))
        );
        setGroups(full.filter(Boolean));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleDone() {
    setActiveForm(null);
    load();
  }

  const groupsWithSuggestions = groups.filter((g) => g.settleUp.length > 0);

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Settle up</h1>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : groupsWithSuggestions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Everyone is settled up across all your groups.
        </p>
      ) : (
        <div className="space-y-4">
          {groupsWithSuggestions.map((g) => (
            <div key={g.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <h2 className="mb-3 font-semibold">{g.name}</h2>
              <ul className="space-y-2 text-sm">
                {g.settleUp.map((t, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span>
                      <strong>{memberName(g.members, t.from)}</strong> owes{" "}
                      <strong>{memberName(g.members, t.to)}</strong>{" "}
                      {formatCurrency(t.amount, g.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveForm({ groupId: g.id, prefill: { from: t.from, to: t.to, amount: t.amount } })
                      }
                      className="shrink-0 text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      Settle
                    </button>
                  </li>
                ))}
              </ul>

              {activeForm?.groupId === g.id && (
                <div className="mt-3">
                  <SettleUpForm
                    groupId={g.id}
                    members={g.members}
                    prefill={activeForm.prefill}
                    onDone={handleDone}
                    onCancel={() => setActiveForm(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
