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

// The dropdown options offered to a group: the app's built-in defaults plus
// whatever custom categories that group has added (see group_categories table).
export function mergeCategories(customCategories = []) {
  const extra = customCategories.filter((c) => !CATEGORIES.includes(c));
  return [...CATEGORIES, ...extra];
}
