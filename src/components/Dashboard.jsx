import { useMemo } from "react";
import PropTypes from "prop-types";
import BarList from "./charts/BarList.jsx";
import DivergingBarList from "./charts/DivergingBarList.jsx";
import { colorsFor } from "./charts/palette.js";
import { formatCurrency } from "../utils/categories";

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

  const isPositive = netBalance > 0.01;
  const isNegative = netBalance < -0.01;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Net balance</p>
          <p
            className={`text-2xl font-semibold ${
              isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-800"
            }`}
          >
            {isPositive && "+"}
            {formatCurrency(netBalance, currency)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {isPositive ? "You are owed overall" : isNegative ? "You owe overall" : "Settled up"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total spent</p>
          <p className="text-2xl font-semibold text-gray-800">{formatCurrency(totalSpent, currency)}</p>
          <p className="mt-1 text-xs text-gray-400">
            Across {groups.length} group{groups.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

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
      <h2 className="text-lg font-semibold">Dashboard</h2>
      {sections.map(([currency, data]) => (
        <div key={currency}>
          {sections.length > 1 && <h3 className="mb-2 text-sm font-medium text-gray-500">{currency}</h3>}
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
