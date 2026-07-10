export const CATEGORIES = [
  "rent",
  "utilities",
  "groceries",
  "subscription",
  "transport",
  "entertainment",
  "other",
];

export function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
}
