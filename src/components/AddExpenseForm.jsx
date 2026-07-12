import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { upload } from "@vercel/blob/client";
import { expensesApi } from "../utils/api";
import { CATEGORIES } from "../utils/categories";
import { CURRENCIES } from "../utils/currencies";

export default function AddExpenseForm({
  groupId,
  members,
  expense,
  duplicateFrom,
  categories = CATEGORIES,
  onAdded,
  onCancel,
}) {
  const isEditing = Boolean(expense);
  const prefill = expense ?? duplicateFrom;

  const [description, setDescription] = useState(prefill?.description ?? "");
  const [amount, setAmount] = useState(prefill ? String(prefill.amount) : "");
  const [category, setCategory] = useState(prefill?.category ?? categories[0]);
  const [expenseDate, setExpenseDate] = useState(
    expense ? expense.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [splitType, setSplitType] = useState(prefill?.split_type ?? "equal");
  const [selected, setSelected] = useState(
    () => new Set(prefill ? prefill.splits.map((s) => s.userId) : members.map((m) => m.id))
  );
  const [exactAmounts, setExactAmounts] = useState(() =>
    prefill ? Object.fromEntries(prefill.splits.map((s) => [s.userId, s.shareAmount])) : {}
  );
  const [percentages, setPercentages] = useState(() =>
    prefill && prefill.split_type === "percentage"
      ? Object.fromEntries(
          prefill.splits.map((s) => [s.userId, ((Number(s.shareAmount) / Number(prefill.amount)) * 100).toFixed(2)])
        )
      : {}
  );
  const [multiPayer, setMultiPayer] = useState(prefill ? prefill.payments.length > 1 : false);
  const [payers, setPayers] = useState(() => new Set(prefill ? prefill.payments.map((p) => p.userId) : []));
  const [payerAmounts, setPayerAmounts] = useState(() =>
    prefill ? Object.fromEntries(prefill.payments.map((p) => [p.userId, p.amount])) : {}
  );
  const [paidBy, setPaidBy] = useState(
    prefill ? (prefill.payments[0]?.userId ?? members[0]?.id ?? "") : (members[0]?.id ?? "")
  );
  const [receiptFile, setReceiptFile] = useState(null);
  const [hasOriginalCurrency, setHasOriginalCurrency] = useState(Boolean(prefill?.original_currency));
  const [originalAmount, setOriginalAmount] = useState(prefill?.original_amount ? String(prefill.original_amount) : "");
  const [originalCurrency, setOriginalCurrency] = useState(prefill?.original_currency ?? CURRENCIES[0].code);
  const nextItemId = useRef(0);
  const [items, setItems] = useState(() =>
    prefill?.split_type === "itemized" ? [] : [{ id: nextItemId.current++, description: "", amount: "", participantIds: [] }]
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (prefill?.id && prefill.split_type === "itemized") {
      expensesApi
        .listItems(prefill.id)
        .then((rows) => {
          setItems(
            rows.length
              ? rows.map((r) => ({
                  id: nextItemId.current++,
                  description: r.description,
                  amount: String(r.amount),
                  participantIds: r.participant_ids,
                }))
              : [{ id: nextItemId.current++, description: "", amount: "", participantIds: [] }]
          );
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.id]);

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

  function addItem() {
    setItems((prev) => [...prev, { id: nextItemId.current++, description: "", amount: "", participantIds: [] }]);
  }

  function removeItem(itemId) {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  }

  function updateItem(itemId, field, value) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, [field]: value } : it)));
  }

  function toggleItemParticipant(itemId, memberId) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const has = it.participantIds.includes(memberId);
        return {
          ...it,
          participantIds: has ? it.participantIds.filter((id) => id !== memberId) : [...it.participantIds, memberId],
        };
      })
    );
  }

  const itemsTotal = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const payload = {
      groupId,
      description,
      amount: Number(amount),
      category,
      splitType,
      expenseDate,
      receiptUrl: expense?.receipt_url ?? null,
    };

    if (splitType === "itemized") {
      const validItems = items.filter(
        (it) => it.description.trim() && Number(it.amount) > 0 && it.participantIds.length > 0
      );
      if (validItems.length === 0) {
        setError("Add at least one item with a description, an amount, and at least one participant");
        return;
      }
      const validItemsTotal = validItems.reduce((sum, it) => sum + Number(it.amount), 0);
      if (Math.abs(validItemsTotal - Number(amount)) > 0.01) {
        setError(`Item amounts must add up to the total expense amount (currently ${validItemsTotal.toFixed(2)})`);
        return;
      }
      payload.items = validItems.map((it) => ({
        description: it.description.trim(),
        amount: Number(it.amount),
        participantIds: it.participantIds,
      }));
    } else {
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
      payload.participants = participants;
    }

    if (hasOriginalCurrency && originalAmount) {
      payload.originalAmount = Number(originalAmount);
      payload.originalCurrency = originalCurrency;
    }

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

        <div className="sm:col-span-2">
          <label className="mb-1 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={hasOriginalCurrency}
              onChange={(e) => setHasOriginalCurrency(e.target.checked)}
            />
            This was paid in a different currency
          </label>
          {hasOriginalCurrency && (
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Original amount"
                value={originalAmount}
                onChange={(e) => setOriginalAmount(e.target.value)}
                className="w-32 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <select
                value={originalCurrency}
                onChange={(e) => setOriginalCurrency(e.target.value)}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            The Amount field above stays in the group's currency and is what splits/balances use - this is just a
            display note.
          </p>
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
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="split-type"
              checked={splitType === "itemized"}
              onChange={() => setSplitType("itemized")}
            />
            Itemized
          </label>
        </div>

        {splitType === "itemized" ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-md border border-gray-200 dark:border-gray-700 p-2">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    placeholder="Item description"
                    className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={item.amount}
                    onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                    className="w-20 shrink-0 rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm sm:w-24"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label="Remove item"
                    className="shrink-0 text-xs text-red-500 dark:text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {members.map((m) => (
                    <label key={m.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={item.participantIds.includes(m.id)}
                        onChange={() => toggleItemParticipant(item.id, m.id)}
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
            >
              + Add item
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Items total: {itemsTotal.toFixed(2)} (must add up to the expense amount)
            </p>
          </div>
        ) : (
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
        )}
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
    original_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    original_currency: PropTypes.string,
    splits: PropTypes.array,
    payments: PropTypes.array,
  }),
  duplicateFrom: PropTypes.shape({
    description: PropTypes.string,
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    category: PropTypes.string,
    split_type: PropTypes.string,
    original_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    original_currency: PropTypes.string,
    splits: PropTypes.array,
    payments: PropTypes.array,
  }),
  categories: PropTypes.arrayOf(PropTypes.string),
  onAdded: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
