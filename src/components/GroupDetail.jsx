import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { groupsApi, expensesApi, recurringApi } from "../utils/api";
import { formatCurrency } from "../utils/categories";
import { CURRENCIES } from "../utils/currencies";
import { useApp } from "../context/AppContext.jsx";
import AddExpenseForm from "./AddExpenseForm.jsx";
import AddRecurringForm from "./AddRecurringForm.jsx";
import AddMemberForm from "./AddMemberForm.jsx";
import BalancesSummary from "./BalancesSummary.jsx";

const TABS = ["Expenses", "Recurring", "Balances", "Members", "Settings"];

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [tab, setTab] = useState("Expenses");
  const [error, setError] = useState("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);

  const [settingsName, setSettingsName] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [settingsCurrency, setSettingsCurrency] = useState("USD");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [confirmingDeleteGroup, setConfirmingDeleteGroup] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState(null);

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

  useEffect(() => {
    if (group) {
      setSettingsName(group.name);
      setSettingsDescription(group.description || "");
      setSettingsCurrency(group.currency);
    }
  }, [group]);

  async function handleDeleteExpense(expenseId) {
    await expensesApi.delete(expenseId);
    loadExpenses();
    loadGroup();
  }

  async function handleDeleteRecurring(recurringId) {
    await recurringApi.delete(recurringId);
    loadRecurring();
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setError("");
    try {
      await groupsApi.update(id, {
        name: settingsName,
        description: settingsDescription,
        currency: settingsCurrency,
      });
      setSettingsSaved(true);
      loadGroup();
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteGroup() {
    if (!confirmingDeleteGroup) {
      setConfirmingDeleteGroup(true);
      return;
    }
    setError("");
    try {
      await groupsApi.delete(id);
      navigate("/");
    } catch (err) {
      setError(err.message);
      setConfirmingDeleteGroup(false);
    }
  }

  async function handleRemoveMember(memberId) {
    if (confirmingRemoveId !== memberId) {
      setConfirmingRemoveId(memberId);
      return;
    }
    setError("");
    setMemberBusyId(memberId);
    try {
      await groupsApi.removeMember(id, memberId);
      setConfirmingRemoveId(null);
      if (memberId === user.id) {
        navigate("/");
      } else {
        loadGroup();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setMemberBusyId(null);
    }
  }

  async function handleRoleToggle(member) {
    setError("");
    setMemberBusyId(member.id);
    try {
      await groupsApi.updateMemberRole(id, member.id, member.role === "owner" ? "member" : "owner");
      loadGroup();
    } catch (err) {
      setError(err.message);
    } finally {
      setMemberBusyId(null);
    }
  }

  if (!group) {
    return <p className="text-sm text-gray-500">{error || "Loading..."}</p>;
  }

  const currentMembership = group.members.find((m) => m.id === user.id);
  const isOwner = currentMembership?.role === "owner";

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
            {group.members.map((m) => {
              const isSelf = m.id === user.id;
              const canRemove = isSelf || isOwner;
              const canToggleRole = isOwner && !isSelf;
              const busy = memberBusyId === m.id;

              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="truncate text-xs text-gray-500">{m.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs uppercase text-gray-400">{m.role}</span>
                    {canToggleRole && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRoleToggle(m)}
                        className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                      >
                        {m.role === "owner" ? "Make member" : "Make owner"}
                      </button>
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemoveMember(m.id)}
                        aria-label={isSelf ? "Leave group" : `Remove ${m.name}`}
                        className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                      >
                        {confirmingRemoveId === m.id
                          ? "Confirm?"
                          : isSelf
                            ? "Leave group"
                            : "Remove"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "Settings" && (
        <div className="space-y-4">
          <form
            onSubmit={handleSaveSettings}
            className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <h2 className="font-semibold">Group settings</h2>
            <div>
              <label htmlFor="settings-name" className="mb-1 block text-sm font-medium text-gray-700">
                Group name
              </label>
              <input
                id="settings-name"
                required
                disabled={!isOwner}
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            <div>
              <label htmlFor="settings-description" className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <input
                id="settings-description"
                disabled={!isOwner}
                value={settingsDescription}
                onChange={(e) => setSettingsDescription(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
            <div>
              <label htmlFor="settings-currency" className="mb-1 block text-sm font-medium text-gray-700">
                Currency
              </label>
              <select
                id="settings-currency"
                disabled={!isOwner}
                value={settingsCurrency}
                onChange={(e) => setSettingsCurrency(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {isOwner && (
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Save changes
                </button>
                {settingsSaved && <span className="text-sm text-green-600">Saved</span>}
              </div>
            )}
            {!isOwner && (
              <p className="text-xs text-gray-500">Only the group owner can edit these settings.</p>
            )}
          </form>

          {isOwner && (
            <div className="rounded-lg border border-red-200 bg-white p-4">
              <h2 className="mb-1 font-semibold text-red-700">Danger zone</h2>
              <p className="mb-3 text-sm text-gray-500">
                Deleting this group permanently removes all its expenses, recurring templates,
                settlements, and members for everyone.
              </p>
              <button
                type="button"
                onClick={handleDeleteGroup}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                {confirmingDeleteGroup ? "Confirm delete group?" : "Delete this group"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
