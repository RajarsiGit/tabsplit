// Shared balance-calculation helpers used by groups.js and settlements.js

// Returns a map of user_id -> net balance (positive = owed money, negative = owes money) for a group.
export async function computeBalances(sql, groupId) {
  const [paidRows, owedRows, sentRows, receivedRows] = await Promise.all([
    sql`SELECT paid_by AS user_id, SUM(amount) AS total FROM expenses WHERE group_id = ${groupId} GROUP BY paid_by`,
    sql`
      SELECT es.user_id, SUM(es.share_amount) AS total
      FROM expense_splits es
      JOIN expenses e ON e.id = es.expense_id
      WHERE e.group_id = ${groupId}
      GROUP BY es.user_id
    `,
    sql`SELECT from_user AS user_id, SUM(amount) AS total FROM settlements WHERE group_id = ${groupId} GROUP BY from_user`,
    sql`SELECT to_user AS user_id, SUM(amount) AS total FROM settlements WHERE group_id = ${groupId} GROUP BY to_user`,
  ]);

  const balances = {};
  const add = (userId, amount) => {
    balances[userId] = (balances[userId] || 0) + Number(amount);
  };

  for (const row of paidRows) add(row.user_id, row.total);
  for (const row of owedRows) add(row.user_id, -row.total);
  for (const row of sentRows) add(row.user_id, row.total);
  for (const row of receivedRows) add(row.user_id, -row.total);

  for (const userId in balances) {
    balances[userId] = Math.round(balances[userId] * 100) / 100;
  }

  return balances;
}

// Greedy debt simplification: turns a map of net balances into a minimal list of
// { from, to, amount } transactions that settle everyone up.
export function simplifyDebts(balances) {
  const creditors = [];
  const debtors = [];

  for (const [userId, amount] of Object.entries(balances)) {
    if (amount > 0.01) creditors.push({ userId: Number(userId), amount });
    else if (amount < -0.01) debtors.push({ userId: Number(userId), amount: -amount });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.round(Math.min(debtor.amount, creditor.amount) * 100) / 100;

    if (amount > 0.01) {
      transactions.push({ from: debtor.userId, to: creditor.userId, amount });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount <= 0.01) i++;
    if (creditor.amount <= 0.01) j++;
  }

  return transactions;
}
