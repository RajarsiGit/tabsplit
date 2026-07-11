import PropTypes from "prop-types";
import { formatCurrency } from "../../utils/categories";

// A magnitude bar list: every entry is a non-negative value compared by bar length.
export default function BarList({ title, entries, currency }) {
  const max = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No data yet.</p>
      ) : entries.length === 1 ? (
        <p className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
          {entries[0].label}: {formatCurrency(entries[0].value, currency)}
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-sm text-gray-700 dark:text-gray-300" title={e.label}>
                {e.label}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-700">
                <div
                  className="h-full rounded-r"
                  style={{ width: `${(e.value / max) * 100}%`, backgroundColor: e.color }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
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
