import { useMemo } from "react";
import PropTypes from "prop-types";
import BarList from "./charts/BarList.jsx";
import DivergingBarList from "./charts/DivergingBarList.jsx";
import SpendOverTimeChart from "./charts/SpendOverTimeChart.jsx";
import { colorsFor } from "./charts/palette.js";
import { formatCurrency } from "../utils/categories";

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

function monthlyTotals(expenses, monthsBack = 6) {
  const now = new Date();
  const buckets = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_FORMATTER.format(d), value: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));

  for (const exp of expenses) {
    const d = new Date(exp.expense_date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (byKey[key]) {
      byKey[key].value += Number(exp.amount);
    }
  }

  return buckets.map(({ label, value }) => ({ label, value: Math.round(value * 100) / 100 }));
}

function CurrencySection({ currency, groups, expenses }) {
  const netBalance = useMemo(
    () => Math.round(groups.reduce((sum, g) => sum + Number(g.my_balance || 0), 0) * 100) / 100,
    [groups]
  );

  const totalSpent = useMemo(
    () => expenses.reduce((sum, exp) => sum + Number(exp.amount), 0),
    [expenses]
  );

  const byCategory = useMemo(() => {
    const totals = {};
    for (const exp of expenses) {
      totals[exp.category] = (totals[exp.category] || 0) + Number(exp.amount);
    }
    const colors = colorsFor(Object.keys(totals));
    return Object.entries(totals)
      .map(([label, value]) => ({ label, value, color: colors[label] }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const byGroup = useMemo(
    () =>
      [...groups]
        .map((g) => ({ label: g.name, value: Number(g.my_balance || 0) }))
        .sort((a, b) => b.value - a.value),
    [groups]
  );

  const byMonth = useMemo(() => monthlyTotals(expenses), [expenses]);

  const isPositive = netBalance > 0.01;
  const isNegative = netBalance < -0.01;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Net balance</p>
          <p
            className={`text-2xl font-semibold ${
              isPositive ? "text-green-600 dark:text-green-400" : isNegative ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {isPositive && "+"}
            {formatCurrency(netBalance, currency)}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {isPositive ? "You are owed overall" : isNegative ? "You owe overall" : "Settled up"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total spent</p>
          <p className="text-2xl font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(totalSpent, currency)}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Across {groups.length} group{groups.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <SpendOverTimeChart title="Spend over time" entries={byMonth} currency={currency} />
      <BarList title="Spend by category" entries={byCategory} currency={currency} />
      {groups.length > 1 && (
        <DivergingBarList title="Balance by group" entries={byGroup} currency={currency} />
      )}
    </div>
  );
}

CurrencySection.propTypes = {
  currency: PropTypes.string.isRequired,
  groups: PropTypes.array.isRequired,
  expenses: PropTypes.array.isRequired,
};

export default function Dashboard({ groups, expensesByGroup }) {
  const sections = useMemo(() => {
    const byCurrency = {};
    for (const group of groups) {
      byCurrency[group.currency] ??= { groups: [], expenses: [] };
      byCurrency[group.currency].groups.push(group);
      byCurrency[group.currency].expenses.push(...(expensesByGroup[group.id] || []));
    }
    return Object.entries(byCurrency).sort(([a], [b]) => a.localeCompare(b));
  }, [groups, expensesByGroup]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 space-y-6">
      {sections.map(([currency, data]) => (
        <div key={currency}>
          {sections.length > 1 && <h3 className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">{currency}</h3>}
          <CurrencySection currency={currency} groups={data.groups} expenses={data.expenses} />
        </div>
      ))}
    </div>
  );
}

Dashboard.propTypes = {
  groups: PropTypes.array.isRequired,
  expensesByGroup: PropTypes.object.isRequired,
};
