import { useState } from "react";
import PropTypes from "prop-types";
import { recurringApi } from "../utils/api";
import { CATEGORIES } from "../utils/categories";

export default function AddRecurringForm({ groupId, members, onAdded, onCancel }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await recurringApi.create({
        groupId,
        description,
        amount: Number(amount),
        category,
        frequency,
        startDate,
        paidBy: Number(paidBy),
      });
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">
        Recurring expenses are split equally among all current group members each time they run.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label htmlFor="recurring-description" className="mb-1 block text-sm font-medium text-gray-700">
            Description
          </label>
          <input
            id="recurring-description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Rent, Netflix"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="recurring-amount" className="mb-1 block text-sm font-medium text-gray-700">
            Amount
          </label>
          <input
            id="recurring-amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="recurring-frequency" className="mb-1 block text-sm font-medium text-gray-700">
            Frequency
          </label>
          <select
            id="recurring-frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label htmlFor="recurring-start" className="mb-1 block text-sm font-medium text-gray-700">
            Starts on
          </label>
          <input
            id="recurring-start"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="recurring-category" className="mb-1 block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="recurring-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="recurring-paid-by" className="mb-1 block text-sm font-medium text-gray-700">
            Paid by
          </label>
          <select
            id="recurring-paid-by"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add recurring expense
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

AddRecurringForm.propTypes = {
  groupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  members: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.number.isRequired, name: PropTypes.string.isRequired })
  ).isRequired,
  onAdded: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
