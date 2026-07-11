import PropTypes from "prop-types";
import { formatCurrency } from "../../utils/categories";

// A diverging bar list for signed values (owed vs. owes) - bars grow left/right from
// a center zero-line instead of all in one direction like BarList.
const POSITIVE_COLOR = "#0ca30c";
const NEGATIVE_COLOR = "#d03b3b";

export default function DivergingBarList({ title, entries, currency }) {
  const maxAbs = Math.max(...entries.map((e) => Math.abs(e.value)), 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const pct = (Math.abs(e.value) / maxAbs) * 50;
            const isPositive = e.value > 0.01;
            const isNegative = e.value < -0.01;
            return (
              <div key={e.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 truncate text-sm text-gray-700" title={e.label}>
                  {e.label}
                </span>
                <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-gray-100">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300" />
                  {isPositive && (
                    <div
                      className="absolute inset-y-0 left-1/2 rounded-r"
                      style={{ width: `${pct}%`, backgroundColor: POSITIVE_COLOR }}
                    />
                  )}
                  {isNegative && (
                    <div
                      className="absolute inset-y-0 rounded-l"
                      style={{ right: "50%", width: `${pct}%`, backgroundColor: NEGATIVE_COLOR }}
                    />
                  )}
                </div>
                <span
                  className={`w-28 shrink-0 text-right text-sm font-medium ${
                    isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-400"
                  }`}
                >
                  {isPositive
                    ? `owed ${formatCurrency(e.value, currency)}`
                    : isNegative
                      ? `owes ${formatCurrency(-e.value, currency)}`
                      : "settled up"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

DivergingBarList.propTypes = {
  title: PropTypes.string.isRequired,
  entries: PropTypes.arrayOf(
    PropTypes.shape({ label: PropTypes.string.isRequired, value: PropTypes.number.isRequired })
  ).isRequired,
  currency: PropTypes.string.isRequired,
};
