import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { groupsApi, expensesApi, recurringApi, invitesApi } from "../utils/api";
import { formatCurrency, mergeCategories } from "../utils/categories";
import { CURRENCIES } from "../utils/currencies";
import { useApp } from "../context/AppContext.jsx";
import AddExpenseForm from "./AddExpenseForm.jsx";
import AddRecurringForm from "./AddRecurringForm.jsx";
import AddMemberForm from "./AddMemberForm.jsx";
import BalancesSummary from "./BalancesSummary.jsx";
import InsightsTab from "./InsightsTab.jsx";
import ExpenseComments from "./ExpenseComments.jsx";

const TABS = ["Expenses", "Recurring", "Balances", "Insights", "Members", "Settings"];

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
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingExpenseLoading, setEditingExpenseLoading] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");
  const [expenseSort, setExpenseSort] = useState("date-desc");
  const [expandedCommentsId, setExpandedCommentsId] = useState(null);
  const [customCategories, setCustomCategories] = useState([]);
  const [newCategory, setNewCategory] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);

  const [settingsName, setSettingsName] = useState("");
  const [settingsDescription, setSettingsDescription] = useState("");
  const [settingsCurrency, setSettingsCurrency] = useState("INR");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [confirmingDeleteGroup, setConfirmingDeleteGroup] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState(null);
  const [confirmingRemoveId, setConfirmingRemoveId] = useState(null);
  const [inviteToken, setInviteToken] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const loadGroup = useCallback(() => {
    groupsApi.get(id).then(setGroup).catch((err) => setError(err.message));
  }, [id]);

  const loadExpenses = useCallback(() => {
    expensesApi.listForGroup(id).then(setExpenses).catch((err) => setError(err.message));
  }, [id]);

  const loadRecurring = useCallback(() => {
    recurringApi.listForGroup(id).then(setRecurring).catch((err) => setError(err.message));
  }, [id]);

  const loadCategories = useCallback(() => {
    groupsApi.listCategories(id).then(setCustomCategories).catch(() => {});
  }, [id]);

  useEffect(() => {
    loadGroup();
    loadExpenses();
    loadRecurring();
    loadCategories();
  }, [loadGroup, loadExpenses, loadRecurring, loadCategories]);

  const categories = useMemo(() => mergeCategories(customCategories), [customCategories]);

  async function handleAddCategory(e) {
    e.preventDefault();
    setError("");
    const name = newCategory.trim().toLowerCase();
    if (!name) return;
    setCategoryBusy(true);
    try {
      await groupsApi.addCategory(id, name);
      setNewCategory("");
      loadCategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setCategoryBusy(false);
    }
  }

  async function handleRemoveCategory(name) {
    setError("");
    setCategoryBusy(true);
    try {
      await groupsApi.removeCategory(id, name);
      loadCategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setCategoryBusy(false);
    }
  }

  useEffect(() => {
    if (group) {
      setSettingsName(group.name);
      setSettingsDescription(group.description || "");
      setSettingsCurrency(group.currency);
    }
  }, [group]);

  useEffect(() => {
    if (!group) return;
    const membership = group.members.find((m) => m.id === user.id);
    if (membership?.role !== "owner") return;
    invitesApi.get(id).then((data) => setInviteToken(data.token)).catch(() => {});
  }, [group, id, user.id]);

  const visibleExpenses = useMemo(() => {
    return expenses
      .filter((e) => expenseCategoryFilter === "all" || e.category === expenseCategoryFilter)
      .filter((e) => !expenseSearch || e.description.toLowerCase().includes(expenseSearch.toLowerCase()))
      .sort((a, b) => {
        if (expenseSort === "date-asc") return new Date(a.expense_date) - new Date(b.expense_date);
        if (expenseSort === "amount-desc") return Number(b.amount) - Number(a.amount);
        if (expenseSort === "amount-asc") return Number(a.amount) - Number(b.amount);
        return new Date(b.expense_date) - new Date(a.expense_date);
      });
  }, [expenses, expenseCategoryFilter, expenseSearch, expenseSort]);

  async function handleDeleteExpense(expenseId) {
    await expensesApi.delete(expenseId);
    loadExpenses();
    loadGroup();
  }

  async function handleStartEditExpense(expenseId) {
    setError("");
    setShowExpenseForm(false);
    setEditingExpenseLoading(true);
    try {
      const full = await expensesApi.get(expenseId);
      setEditingExpense(full);
    } catch (err) {
      setError(err.message);
    } finally {
      setEditingExpenseLoading(false);
    }
  }

  async function handleDeleteRecurring(recurringId) {
    await recurringApi.delete(recurringId);
    loadRecurring();
  }

  async function handleToggleRecurringActive(recurringExpense) {
    setError("");
    try {
      await recurringApi.update({ id: recurringExpense.id, active: !recurringExpense.active });
      loadRecurring();
    } catch (err) {
      setError(err.message);
    }
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

  async function handleToggleArchived() {
    setError("");
    try {
      await groupsApi.setArchived(id, !group.archived_at);
      loadGroup();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateInvite() {
    setError("");
    setInviteBusy(true);
    try {
      const { token } = await invitesApi.generate(id);
      setInviteToken(token);
    } catch (err) {
      setError(err.message);
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRevokeInvite() {
    setError("");
    setInviteBusy(true);
    try {
      await invitesApi.revoke(id);
      setInviteToken(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setInviteBusy(false);
    }
  }

  function handleCopyInvite() {
    const url = `${window.location.origin}/invite/${inviteToken}`;
    navigator.clipboard.writeText(url);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
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
    return <p className="text-sm text-gray-500 dark:text-gray-400">{error || "Loading..."}</p>;
  }

  const currentMembership = group.members.find((m) => m.id === user.id);
  const isOwner = currentMembership?.role === "owner";

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600 dark:text-brand-400 hover:underline">
        &larr; Back to groups
      </Link>

      <h1 className="mb-1 text-xl font-bold">{group.name}</h1>
      {group.description && <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{group.description}</p>}

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium ${
              tab === t
                ? "border-b-2 border-brand-600 text-brand-600 dark:text-brand-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
              onClick={() => {
                setEditingExpense(null);
                setShowExpenseForm((v) => !v);
              }}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {showExpenseForm ? "Cancel" : "Add expense"}
            </button>
          </div>

          {showExpenseForm && (
            <AddExpenseForm
              groupId={id}
              members={group.members}
              categories={categories}
              onAdded={() => {
                setShowExpenseForm(false);
                loadExpenses();
                loadGroup();
              }}
              onCancel={() => setShowExpenseForm(false)}
            />
          )}

          {editingExpenseLoading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading expense...</p>}

          {editingExpense && (
            <AddExpenseForm
              groupId={id}
              members={group.members}
              expense={editingExpense}
              categories={categories}
              onAdded={() => {
                setEditingExpense(null);
                loadExpenses();
                loadGroup();
              }}
              onCancel={() => setEditingExpense(null)}
            />
          )}

          {expenses.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <input
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                placeholder="Search description..."
                className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <select
                value={expenseCategoryFilter}
                onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={expenseSort}
                onChange={(e) => setExpenseSort(e.target.value)}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="date-desc">Newest first</option>
                <option value="date-asc">Oldest first</option>
                <option value="amount-desc">Amount: high to low</option>
                <option value="amount-asc">Amount: low to high</option>
              </select>
            </div>
          )}

          {expenses.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No expenses yet.</p>
          ) : visibleExpenses.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No expenses match these filters.</p>
          ) : (
            <ul className="space-y-2">
              {visibleExpenses.map((exp) => (
                <li
                  key={exp.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{exp.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {exp.expense_date} &middot; {exp.category} &middot; paid by {exp.paid_by_names || "no one"}
                        {exp.receipt_url && (
                          <>
                            {" "}
                            &middot;{" "}
                            <a
                              href={exp.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-600 dark:text-brand-400 hover:underline"
                            >
                              &#128206; Receipt
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="font-semibold">{formatCurrency(exp.amount, group.currency)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCommentsId((cur) => (cur === exp.id ? null : exp.id))
                        }
                        className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        {expandedCommentsId === exp.id ? "Hide comments" : "Comments"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartEditExpense(exp.id)}
                        aria-label={`Edit expense ${exp.description}`}
                        className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp.id)}
                        aria-label={`Delete expense ${exp.description}`}
                        className="text-sm text-red-500 dark:text-red-400 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {expandedCommentsId === exp.id && (
                    <div className="mt-3">
                      <ExpenseComments expenseId={exp.id} />
                    </div>
                  )}
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
              categories={categories}
              onAdded={() => {
                setShowRecurringForm(false);
                loadRecurring();
              }}
              onCancel={() => setShowRecurringForm(false)}
            />
          )}

          {recurring.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No recurring expenses yet.</p>
          ) : (
            <ul className="space-y-2">
              {recurring.map((r) => (
                <li
                  key={r.id}
                  className={`flex flex-col gap-2 rounded-lg border bg-white dark:bg-gray-800 p-4 sm:flex-row sm:items-center sm:justify-between ${
                    r.active ? "border-gray-200 dark:border-gray-700" : "border-gray-200 dark:border-gray-700 opacity-60"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {r.description}
                      {!r.active && (
                        <span className="ml-2 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                          Paused
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {r.frequency} &middot; {r.category} &middot; paid by {r.paid_by_name} &middot; next on{" "}
                      {r.next_occurrence}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="font-semibold">{formatCurrency(r.amount, group.currency)}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleRecurringActive(r)}
                      aria-label={`${r.active ? "Pause" : "Resume"} recurring expense ${r.description}`}
                      className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      {r.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRecurring(r.id)}
                      aria-label={`Delete recurring expense ${r.description}`}
                      className="text-sm text-red-500 dark:text-red-400 hover:underline"
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

      {tab === "Insights" && (
        <InsightsTab expenses={expenses} members={group.members} currency={group.currency} />
      )}

      {tab === "Members" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
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
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{m.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs uppercase text-gray-400 dark:text-gray-500">{m.role}</span>
                    {canToggleRole && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRoleToggle(m)}
                        className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
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
                        className="text-xs font-medium text-red-500 dark:text-red-400 hover:underline disabled:opacity-50"
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
            className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
          >
            <h2 className="font-semibold">Group settings</h2>
            <div>
              <label htmlFor="settings-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Group name
              </label>
              <input
                id="settings-name"
                required
                disabled={!isOwner}
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-400"
              />
            </div>
            <div>
              <label htmlFor="settings-description" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <input
                id="settings-description"
                disabled={!isOwner}
                value={settingsDescription}
                onChange={(e) => setSettingsDescription(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-400"
              />
            </div>
            <div>
              <label htmlFor="settings-currency" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Currency
              </label>
              <select
                id="settings-currency"
                disabled={!isOwner}
                value={settingsCurrency}
                onChange={(e) => setSettingsCurrency(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 dark:disabled:text-gray-400"
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
                {settingsSaved && <span className="text-sm text-green-600 dark:text-green-400">Saved</span>}
              </div>
            )}
            {!isOwner && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Only the group owner can edit these settings.</p>
            )}
          </form>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <h2 className="mb-1 font-semibold">Categories</h2>
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              Custom categories are added to this group's expense form on top of the built-in ones.
            </p>
            <ul className="mb-3 flex flex-wrap gap-2">
              {customCategories.length === 0 ? (
                <li className="text-sm text-gray-400 dark:text-gray-500">No custom categories yet.</li>
              ) : (
                customCategories.map((c) => (
                  <li
                    key={c}
                    className="flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    {c}
                    {isOwner && (
                      <button
                        type="button"
                        disabled={categoryBusy}
                        onClick={() => handleRemoveCategory(c)}
                        aria-label={`Remove category ${c}`}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                      >
                        &times;
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. childcare"
                className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={categoryBusy || !newCategory.trim()}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
              >
                Add
              </button>
            </form>
          </div>

          {isOwner && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <h2 className="mb-1 font-semibold">Invite link</h2>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                Anyone with this link can join the group. Regenerating replaces the old link.
              </p>
              {inviteToken ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      readOnly
                      value={`${window.location.origin}/invite/${inviteToken}`}
                      className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      {inviteCopied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={inviteBusy}
                      onClick={handleGenerateInvite}
                      className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      disabled={inviteBusy}
                      onClick={handleRevokeInvite}
                      className="text-sm font-medium text-red-500 dark:text-red-400 hover:underline disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={handleGenerateInvite}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Generate invite link
                </button>
              )}
            </div>
          )}

          {isOwner && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <h2 className="mb-1 font-semibold">{group.archived_at ? "Archived" : "Archive"}</h2>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                {group.archived_at
                  ? "This group is archived and hidden from your default groups list. Nothing was deleted."
                  : "Hide this group from your default groups list without deleting anything. You can unarchive it any time."}
              </p>
              <button
                type="button"
                onClick={handleToggleArchived}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900"
              >
                {group.archived_at ? "Unarchive this group" : "Archive this group"}
              </button>
            </div>
          )}

          {isOwner && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-gray-800 p-4">
              <h2 className="mb-1 font-semibold text-red-700">Danger zone</h2>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                Deleting this group permanently removes all its expenses, recurring templates,
                settlements, and members for everyone.
              </p>
              <button
                type="button"
                onClick={handleDeleteGroup}
                className="rounded-md border border-red-300 dark:border-red-800 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
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
