import { useState } from "react";
import PropTypes from "prop-types";
import { formatCurrency } from "../utils/categories";
import SettleUpForm from "./SettleUpForm.jsx";

function memberName(members, id) {
  return members.find((m) => m.id === Number(id))?.name ?? "Unknown";
}

export default function BalancesSummary({ groupId, members, balances, settleUp, currency, onChanged }) {
  const [prefill, setPrefill] = useState(undefined);
  const [showForm, setShowForm] = useState(false);

  function openForm(fill) {
    setPrefill(fill);
    setShowForm(true);
  }

  function handleDone() {
    setShowForm(false);
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Balances</h2>
        <ul className="space-y-2 text-sm">
          {members.map((m) => {
            const balance = balances[m.id] ?? 0;
            return (
              <li key={m.id} className="flex items-center justify-between">
                <span>{m.name}</span>
                {balance > 0.01 ? (
                  <span className="text-green-600">is owed {formatCurrency(balance, currency)}</span>
                ) : balance < -0.01 ? (
                  <span className="text-red-600">owes {formatCurrency(-balance, currency)}</span>
                ) : (
                  <span className="text-gray-400">settled up</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Settle up</h2>
          <button
            type="button"
            onClick={() => openForm(undefined)}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Record a payment
          </button>
        </div>

        {settleUp.length === 0 ? (
          <p className="text-sm text-gray-400">Everyone is settled up.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {settleUp.map((t, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>
                  <strong>{memberName(members, t.from)}</strong> owes{" "}
                  <strong>{memberName(members, t.to)}</strong> {formatCurrency(t.amount, currency)}
                </span>
                <button
                  type="button"
                  onClick={() => openForm({ from: t.from, to: t.to, amount: t.amount })}
                  className="text-brand-600 hover:underline"
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
