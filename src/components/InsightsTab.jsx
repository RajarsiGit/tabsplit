import { useMemo } from "react";
import PropTypes from "prop-types";
import { formatCurrency } from "../utils/categories";

// Validated 8-slot categorical palette (see the dataviz skill's reference/palette.md) -
// fixed order, assigned by sorted entity name so a category/member keeps its color
// across reloads instead of repainting when the data changes.
const CATEGORICAL = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"];
const OTHER_COLOR = "#898781";

function colorsFor(names) {
  const colorByName = {};
  [...names].sort().forEach((name, i) => {
    colorByName[name] = i < CATEGORICAL.length ? CATEGORICAL[i] : OTHER_COLOR;
  });
  return colorByName;
}

function BarList({ title, entries, currency }) {
  const max = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No data yet.</p>
      ) : entries.length === 1 ? (
        <p className="text-2xl font-semibold text-gray-800">
          {entries[0].label}: {formatCurrency(entries[0].value, currency)}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-sm text-gray-700" title={e.label}>
                {e.label}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-sm bg-gray-100">
                <div
                  className="h-full rounded-r"
                  style={{ width: `${(e.value / max) * 100}%`, backgroundColor: e.color }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-sm font-medium text-gray-700">
                {formatCurrency(e.value, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

BarList.propTypes = {
  title: PropTypes.string.isRequired,
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
      color: PropTypes.string,
    })
  ).isRequired,
  currency: PropTypes.string.isRequired,
};

export default function InsightsTab({ expenses, members, currency }) {
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

  const byMember = useMemo(() => {
    const totals = {};
    for (const exp of expenses) {
      for (const payment of exp.payments || []) {
        totals[payment.userId] = (totals[payment.userId] || 0) + Number(payment.amount);
      }
    }
    const nameById = Object.fromEntries(members.map((m) => [m.id, m.name]));
    const colors = colorsFor(Object.values(nameById));
    return Object.entries(totals)
      .map(([userId, value]) => {
        const label = nameById[userId] || "Unknown";
        return { label, value, color: colors[label] };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenses, members]);

  return (
    <div className="space-y-4">
      <BarList title="Spend by category" entries={byCategory} currency={currency} />
      <BarList title="Paid by member" entries={byMember} currency={currency} />
    </div>
  );
}

InsightsTab.propTypes = {
  expenses: PropTypes.array.isRequired,
  members: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.number.isRequired, name: PropTypes.string.isRequired }))
    .isRequired,
  currency: PropTypes.string.isRequired,
};
