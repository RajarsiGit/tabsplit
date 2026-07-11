import { useMemo } from "react";
import PropTypes from "prop-types";
import BarList from "./charts/BarList.jsx";
import { colorsFor } from "./charts/palette.js";

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
