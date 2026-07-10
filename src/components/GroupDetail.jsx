import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { groupsApi, expensesApi, recurringApi } from "../utils/api";
import { formatCurrency } from "../utils/categories";
import AddExpenseForm from "./AddExpenseForm.jsx";
import AddRecurringForm from "./AddRecurringForm.jsx";
import AddMemberForm from "./AddMemberForm.jsx";
import BalancesSummary from "./BalancesSummary.jsx";

const TABS = ["Expenses", "Recurring", "Balances", "Members"];

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [tab, setTab] = useState("Expenses");
  const [error, setError] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);

  const loadGroup = useCallback(() => {
    groupsApi.get(id).then(setGroup).catch((err) => setError(err.message));
  }, [id]);

  const loadExpenses = useCallback(() => {
    expensesApi.listForGroup(id).then(setExpenses).catch((err) => setError(err.message));
  }, [id]);

  const loadRecurring = useCallback(() => {
    recurringApi.listForGroup(id).then(setRecurring).catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    loadGroup();
    loadExpenses();
    loadRecurring();
  }, [loadGroup, loadExpenses, loadRecurring]);

  async function handleDeleteExpense(expenseId) {
    await expensesApi.delete(expenseId);
    loadExpenses();
    loadGroup();
  }

  async function handleDeleteRecurring(recurringId) {
    await recurringApi.delete(recurringId);
    loadRecurring();
  }

  if (!group) {
    return <p className="text-sm text-gray-500">{error || "Loading..."}</p>;
  }

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        &larr; Back to groups
      </Link>

      <h1 className="mb-1 text-xl font-bold">{group.name}</h1>
      {group.description && <p className="mb-4 text-sm text-gray-500">{group.description}</p>}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-brand-600 text-brand-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Expenses" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowExpenseForm((v) => !v)}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {showExpenseForm ? "Cancel" : "Add expense"}
            </button>
          </div>

          {showExpenseForm && (
            <AddExpenseForm
              groupId={id}
              members={group.members}
              onAdded={() => {
                setShowExpenseForm(false);
                loadExpenses();
                loadGroup();
              }}
              onCancel={() => setShowExpenseForm(false)}
            />
          )}

          {expenses.length === 0 ? (
            <p className="text-sm text-gray-500">No expenses yet.</p>
          ) : (
            <ul className="space-y-2">
              {expenses.map((exp) => (
                <li
                  key={exp.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{exp.description}</p>
                    <p className="text-xs text-gray-500">
                      {exp.expense_date} &middot; {exp.category} &middot; paid by {exp.paid_by_name}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="font-semibold">{formatCurrency(exp.amount, group.currency)}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id)}
                      aria-label={`Delete expense ${exp.description}`}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "Recurring" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowRecurringForm((v) => !v)}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {showRecurringForm ? "Cancel" : "Add recurring expense"}
            </button>
          </div>

          {showRecurringForm && (
            <AddRecurringForm
              groupId={id}
              members={group.members}
              onAdded={() => {
                setShowRecurringForm(false);
                loadRecurring();
              }}
              onCancel={() => setShowRecurringForm(false)}
            />
          )}

          {recurring.length === 0 ? (
            <p className="text-sm text-gray-500">No recurring expenses yet.</p>
          ) : (
            <ul className="space-y-2">
              {recurring.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.description}</p>
                    <p className="text-xs text-gray-500">
                      {r.frequency} &middot; {r.category} &middot; paid by {r.paid_by_name} &middot; next on{" "}
                      {r.next_occurrence}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="font-semibold">{formatCurrency(r.amount, group.currency)}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRecurring(r.id)}
                      aria-label={`Delete recurring expense ${r.description}`}
                      className="text-sm text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "Balances" && (
        <BalancesSummary
          groupId={id}
          members={group.members}
          balances={group.balances}
          settleUp={group.settleUp}
          currency={group.currency}
          onChanged={loadGroup}
        />
      )}

      {tab === "Members" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <AddMemberForm groupId={id} onAdded={loadGroup} />
          </div>
          <ul className="space-y-2">
            {group.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="truncate text-xs text-gray-500">{m.email}</p>
                </div>
                <span className="shrink-0 text-xs uppercase text-gray-400">{m.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
