import { useState } from "react";
import PropTypes from "prop-types";
import { settlementsApi } from "../utils/api";

export default function SettleUpForm({ groupId, members, prefill, onDone, onCancel }) {
  const [fromUser, setFromUser] = useState(prefill?.from ?? members[0]?.id ?? "");
  const [toUser, setToUser] = useState(prefill?.to ?? members[1]?.id ?? members[0]?.id ?? "");
  const [amount, setAmount] = useState(prefill?.amount ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (Number(fromUser) === Number(toUser)) {
      setError("Choose two different people");
      return;
    }

    setSubmitting(true);
    try {
      await settlementsApi.create({
        groupId,
        fromUser: Number(fromUser),
        toUser: Number(toUser),
        amount: Number(amount),
        note,
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="settle-from" className="mb-1 block text-sm font-medium text-gray-700">
            Paid by
          </label>
          <select
            id="settle-from"
            value={fromUser}
            onChange={(e) => setFromUser(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="settle-to" className="mb-1 block text-sm font-medium text-gray-700">
            Paid to
          </label>
          <select
            id="settle-to"
            value={toUser}
            onChange={(e) => setToUser(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="settle-amount" className="mb-1 block text-sm font-medium text-gray-700">
          Amount
        </label>
        <input
          id="settle-amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="settle-note" className="mb-1 block text-sm font-medium text-gray-700">
          Note (optional)
        </label>
        <input
          id="settle-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Record payment
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

SettleUpForm.propTypes = {
  groupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  members: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.number.isRequired, name: PropTypes.string.isRequired })
  ).isRequired,
  prefill: PropTypes.shape({
    from: PropTypes.number,
    to: PropTypes.number,
    amount: PropTypes.number,
  }),
  onDone: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

SettleUpForm.defaultProps = {
  prefill: null,
};
