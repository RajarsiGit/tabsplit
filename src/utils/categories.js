export const CATEGORIES = [
  "rent",
  "utilities",
  "groceries",
  "subscription",
  "transport",
  "entertainment",
  "other",
];

export function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
}
