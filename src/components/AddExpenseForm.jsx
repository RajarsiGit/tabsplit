import { useState } from "react";
import PropTypes from "prop-types";
import { upload } from "@vercel/blob/client";
import { expensesApi } from "../utils/api";
import { CATEGORIES } from "../utils/categories";

export default function AddExpenseForm({ groupId, members, expense, categories = CATEGORIES, onAdded, onCancel }) {
  const isEditing = Boolean(expense);

  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState(expense?.category ?? categories[0]);
  const [expenseDate, setExpenseDate] = useState(
    expense ? expense.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [splitType, setSplitType] = useState(expense?.split_type ?? "equal");
  const [selected, setSelected] = useState(
    () => new Set(expense ? expense.splits.map((s) => s.userId) : members.map((m) => m.id))
  );
  const [exactAmounts, setExactAmounts] = useState(() =>
    expense ? Object.fromEntries(expense.splits.map((s) => [s.userId, s.shareAmount])) : {}
  );
  const [percentages, setPercentages] = useState(() =>
    expense && expense.split_type === "percentage"
      ? Object.fromEntries(
          expense.splits.map((s) => [s.userId, ((Number(s.shareAmount) / Number(expense.amount)) * 100).toFixed(2)])
        )
      : {}
  );
  const [multiPayer, setMultiPayer] = useState(expense ? expense.payments.length > 1 : false);
  const [payers, setPayers] = useState(() => new Set(expense ? expense.payments.map((p) => p.userId) : []));
  const [payerAmounts, setPayerAmounts] = useState(() =>
    expense ? Object.fromEntries(expense.payments.map((p) => [p.userId, p.amount])) : {}
  );
  const [paidBy, setPaidBy] = useState(
    expense ? (expense.payments[0]?.userId ?? members[0]?.id ?? "") : (members[0]?.id ?? "")
  );
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
    } else if (splitType === "percentage") {
      const totalPct = participantIds.reduce((sum, id) => sum + Number(percentages[id] || 0), 0);
      if (Math.abs(totalPct - 100) > 0.5) {
        setError(`Percentages must add up to 100 (currently ${totalPct.toFixed(1)})`);
        return;
      }
      participants = participantIds.map((id) => ({
        userId: id,
        percentage: Number(percentages[id] || 0),
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
      receiptUrl: expense?.receipt_url ?? null,
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
      if (isEditing) {
        await expensesApi.update({ id: expense.id, ...payload });
      } else {
        await expensesApi.create(payload);
      }
      onAdded();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="expense-description" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <input
            id="expense-description"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Groceries at Trader Joe's"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="expense-amount" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="expense-date" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Date
          </label>
          <input
            id="expense-date"
            type="date"
            required
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label htmlFor="expense-category" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Category
          </label>
          <select
            id="expense-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="expense-paid-by" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Paid by
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={multiPayer}
                onChange={(e) => setMultiPayer(e.target.checked)}
              />
              Split the payment too
            </label>
          </div>

          {multiPayer ? (
            <div className="space-y-2 rounded-md border border-gray-200 dark:border-gray-700 p-2">
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
                      className="w-20 shrink-0 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm sm:w-24"
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
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
        <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Split</legend>
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
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="split-type"
              checked={splitType === "percentage"}
              onChange={() => setSplitType("percentage")}
            />
            Percentages
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
                  className="w-20 shrink-0 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm sm:w-24"
                />
              )}
              {splitType === "percentage" && selected.has(m.id) && (
                <div className="flex shrink-0 items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={percentages[m.id] ?? ""}
                    onChange={(e) =>
                      setPercentages((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    className="w-16 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm sm:w-20"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">%</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {splitType === "percentage" && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Total: {[...selected].reduce((sum, id) => sum + Number(percentages[id] || 0), 0).toFixed(1)}%
            (must add up to 100)
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="expense-receipt" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Receipt (optional)
        </label>
        {isEditing && expense.receipt_url && !receiptFile && (
          <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            A receipt is already attached. Choose a file to replace it.
          </p>
        )}
        <input
          id="expense-receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600 dark:text-gray-300"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isEditing ? "Save changes" : "Add expense"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900"
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
  expense: PropTypes.shape({
    id: PropTypes.number.isRequired,
    description: PropTypes.string,
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    category: PropTypes.string,
    expense_date: PropTypes.string,
    split_type: PropTypes.string,
    receipt_url: PropTypes.string,
    splits: PropTypes.array,
    payments: PropTypes.array,
  }),
  categories: PropTypes.arrayOf(PropTypes.string),
  onAdded: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
