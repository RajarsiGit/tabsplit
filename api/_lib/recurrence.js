// Shared date math for recurring expenses.

export function nextOccurrence(dateStr, frequency) {
  const date = new Date(`${dateStr}T00:00:00Z`);

  if (frequency === "weekly") {
    date.setUTCDate(date.getUTCDate() + 7);
  } else {
    // monthly - preserve day-of-month, clamping to the last day of the target month
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, daysInMonth));
  }

  return date.toISOString().slice(0, 10);
}
