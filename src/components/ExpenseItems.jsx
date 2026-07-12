import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { expensesApi } from "../utils/api";
import { formatCurrency } from "../utils/categories";

export default function ExpenseItems({ expenseId, members, currency }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    expensesApi
      .listItems(expenseId)
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [expenseId]);

  function memberName(userId) {
    return members.find((m) => m.id === userId)?.name ?? "Unknown";
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading items...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No items recorded.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{item.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.participant_ids.map((id) => memberName(id)).join(", ")}
                </p>
              </div>
              <span className="shrink-0 font-medium">{formatCurrency(item.amount, currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

ExpenseItems.propTypes = {
  expenseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  members: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.number.isRequired, name: PropTypes.string.isRequired })
  ).isRequired,
  currency: PropTypes.string.isRequired,
};
