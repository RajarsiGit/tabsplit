import { useState } from "react";
import PropTypes from "prop-types";
import { upload } from "@vercel/blob/client";
import { expensesApi } from "../utils/api";
import { CATEGORIES } from "../utils/categories";

export default function AddExpenseForm({ groupId, members, onAdded, onCancel }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? "");
  const [splitType, setSplitType] = useState("equal");
  const [selected, setSelected] = useState(() => new Set(members.map((m) => m.id)));
  const [exactAmounts, setExactAmounts] = useState({});
  const [multiPayer, setMultiPayer] = useState(false);
  const [payers, setPayers] = useState(() => new Set());
  const [payerAmounts, setPayerAmounts] = useState({});
  const [receiptFile, setReceiptFile] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleMember(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePayer(id) {
    setPayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const participantIds = [...selected];
    if (participantIds.length === 0) {
      setError("Select at least one participant");
      return;
    }

    let participants;
    if (splitType === "exact") {
      participants = participantIds.map((id) => ({
        userId: id,
        shareAmount: Number(exactAmounts[id] || 0),
      }));
    } else {
      participants = participantIds.map((id) => ({ userId: id }));
    }

    const payload = {
      groupId,
      description,
      amount: Number(amount),
      category,
      splitType,
      expenseDate,
      participants,
    };

    if (multiPayer) {
      const payerIds = [...payers];
      if (payerIds.length === 0) {
        setError("Select at least one payer");
        return;
      }
      payload.payments = payerIds.map((id) => ({
        userId: id,
        amount: Number(payerAmounts[id] || 0),
      }));
    } else {
      payload.paidBy = Number(paidBy);
    }

    setSubmitting(true);
    try {
      if (receiptFile) {
        const blob = await upload(receiptFile.name, receiptFile, {
          access: "public",
          handleUploadUrl: "/api/blob-upload",
        });
        payload.receiptUrl = blob.url;
      }
      await expensesApi.create(payload);
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="expense-description" className="mb-1 block text-sm font-medium text-gray-700">
            Description
          </label>
          <input
            id="expense-description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Groceries at Trader Joe's"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="expense-amount" className="mb-1 block text-sm font-medium text-gray-700">
            Amount
          </label>
          <input
            id="expense-amount"
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
          <label htmlFor="expense-date" className="mb-1 block text-sm font-medium text-gray-700">
            Date
          </label>
          <input
            id="expense-date"
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="expense-category" className="mb-1 block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="expense-category"
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

        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="expense-paid-by" className="block text-sm font-medium text-gray-700">
              Paid by
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={multiPayer}
                onChange={(e) => setMultiPayer(e.target.checked)}
              />
              Split the payment too
            </label>
          </div>

          {multiPayer ? (
            <div className="space-y-2 rounded-md border border-gray-200 p-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <input type="checkbox" checked={payers.has(m.id)} onChange={() => togglePayer(m.id)} />
                    <span className="truncate">{m.name}</span>
                  </label>
                  {payers.has(m.id) && (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={payerAmounts[m.id] ?? ""}
                      onChange={(e) => setPayerAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      className="w-20 shrink-0 rounded-md border border-gray-300 px-2 py-1 text-sm sm:w-24"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <select
              id="expense-paid-by"
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
          )}
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-gray-700">Split</legend>
        <div className="mb-3 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="split-type"
              checked={splitType === "equal"}
              onChange={() => setSplitType("equal")}
            />
            Equally
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="split-type"
              checked={splitType === "exact"}
              onChange={() => setSplitType("exact")}
            />
            Exact amounts
          </label>
        </div>

        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggleMember(m.id)}
                />
                <span className="truncate">{m.name}</span>
              </label>
              {splitType === "exact" && selected.has(m.id) && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={exactAmounts[m.id] ?? ""}
                  onChange={(e) =>
                    setExactAmounts((prev) => ({ ...prev, [m.id]: e.target.value }))
                  }
                  className="w-20 shrink-0 rounded-md border border-gray-300 px-2 py-1 text-sm sm:w-24"
                />
              )}
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="expense-receipt" className="mb-1 block text-sm font-medium text-gray-700">
          Receipt (optional)
        </label>
        <input
          id="expense-receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Add expense
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

AddExpenseForm.propTypes = {
  groupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  members: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.number.isRequired, name: PropTypes.string.isRequired })
  ).isRequired,
  onAdded: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
