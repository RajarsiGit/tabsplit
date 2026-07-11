import PropTypes from "prop-types";
import { formatCurrency } from "../../utils/categories";

// A single-series monthly magnitude chart - one color, since a single series needs
// no legend (the title already names it). Thin bars, rounded data-ends, recessive
// baseline; the exact value is available via the native title tooltip on hover.
export default function SpendOverTimeChart({ title, entries, currency }) {
  const max = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No data yet.</p>
      ) : (
        <div className="flex h-40 items-end gap-2 overflow-x-auto border-b border-gray-100 dark:border-gray-700 pb-1">
          {entries.map((e) => (
            <div key={e.label} className="flex h-full min-w-[2.5rem] flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {formatCurrency(e.value, currency)}
              </span>
              <div
                title={`${e.label}: ${formatCurrency(e.value, currency)}`}
                className="w-full max-w-6 rounded-t bg-brand-500 dark:bg-brand-400"
                style={{ height: `${Math.max((e.value / max) * 100, 2)}%` }}
              />
              <span className="whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">{e.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

SpendOverTimeChart.propTypes = {
  title: PropTypes.string.isRequired,
  entries: PropTypes.arrayOf(
    PropTypes.shape({ label: PropTypes.string.isRequired, value: PropTypes.number.isRequired })
  ).isRequired,
  currency: PropTypes.string.isRequired,
};
