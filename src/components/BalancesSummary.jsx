import { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { formatCurrency } from "../utils/categories";
import { settlementsApi } from "../utils/api";
import SettleUpForm from "./SettleUpForm.jsx";

function memberName(members, id) {
  return members.find((m) => m.id === Number(id))?.name ?? "Unknown";
}

export default function BalancesSummary({ groupId, members, balances, settleUp, currency, onChanged }) {
  const [prefill, setPrefill] = useState(undefined);
  const [showForm, setShowForm] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [error, setError] = useState("");

  const loadSettlements = useCallback(() => {
    settlementsApi
      .listForGroup(groupId)
      .then(setSettlements)
      .catch((err) => setError(err.message));
  }, [groupId]);

  useEffect(() => {
    loadSettlements();
  }, [loadSettlements]);

  function openForm(fill) {
    setPrefill(fill);
    setShowForm(true);
  }

  function handleDone() {
    setShowForm(false);
    loadSettlements();
    onChanged();
  }

  async function handleDeleteSettlement(settlementId) {
    setError("");
    try {
      await settlementsApi.delete(settlementId);
      loadSettlements();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 className="mb-3 font-semibold">Balances</h2>
        <ul className="space-y-2 text-sm">
          {members.map((m) => {
            const balance = balances[m.id] ?? 0;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="min-w-0 truncate">{m.name}</span>
                {balance > 0.01 ? (
                  <span className="text-green-600 dark:text-green-400">is owed {formatCurrency(balance, currency)}</span>
                ) : balance < -0.01 ? (
                  <span className="text-red-600 dark:text-red-400">owes {formatCurrency(-balance, currency)}</span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">settled up</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Settle up</h2>
          <button
            type="button"
            onClick={() => openForm(undefined)}
            className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            Record a payment
          </button>
        </div>

        {settleUp.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Everyone is settled up.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {settleUp.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span>
                  <strong>{memberName(members, t.from)}</strong> owes{" "}
                  <strong>{memberName(members, t.to)}</strong> {formatCurrency(t.amount, currency)}
                </span>
                <button
                  type="button"
                  onClick={() => openForm({ from: t.from, to: t.to, amount: t.amount })}
                  className="shrink-0 text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Settle
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && (
        <SettleUpForm
          groupId={groupId}
          members={members}
          prefill={prefill}
          onDone={handleDone}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 className="mb-3 font-semibold">Settlement history</h2>
        {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {settlements.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No settlements recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {settlements.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span>
                  <strong>{s.from_user_name}</strong> paid <strong>{s.to_user_name}</strong>{" "}
                  {formatCurrency(s.amount, currency)}
                  {s.note && <span className="text-gray-400 dark:text-gray-500"> &middot; {s.note}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteSettlement(s.id)}
                  aria-label={`Remove settlement from ${s.from_user_name} to ${s.to_user_name}`}
                  className="shrink-0 text-red-500 dark:text-red-400 hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

BalancesSummary.propTypes = {
  groupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  members: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.number.isRequired, name: PropTypes.string.isRequired })
  ).isRequired,
  balances: PropTypes.object.isRequired,
  settleUp: PropTypes.arrayOf(
    PropTypes.shape({ from: PropTypes.number, to: PropTypes.number, amount: PropTypes.number })
  ).isRequired,
  currency: PropTypes.string.isRequired,
  onChanged: PropTypes.func.isRequired,
};
