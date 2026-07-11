import { getDb } from "../_lib/db.js";
import { computeBalances, simplifyDebts } from "../_lib/balances.js";
import { createNotification } from "../notifications.js";
import { formatCurrency } from "../_lib/format.js";

// Vercel Cron job (see vercel.json "crons") - runs weekly and nudges anyone with an
// outstanding balance in a group to settle up, reusing the same debt-simplification
// logic as the group's "Settle up" tab.
export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const sql = getDb();

  try {
    const groups = await sql`SELECT id, name, currency FROM groups`;
    let remindersSent = 0;

    for (const group of groups) {
      const balances = await computeBalances(sql, group.id);
      const transactions = simplifyDebts(balances);
      if (transactions.length === 0) continue;

      const userIds = [...new Set(transactions.flatMap((t) => [t.from, t.to]))];
      const nameById = {};
      for (const userId of userIds) {
        const rows = await sql`SELECT name FROM users WHERE id = ${userId}`;
        nameById[userId] = rows[0]?.name;
      }

      for (const t of transactions) {
        await createNotification(sql, {
          userId: t.from,
          groupId: group.id,
          type: "settle_up_reminder",
          message: `Reminder: you owe ${nameById[t.to] || "a group member"} ${formatCurrency(t.amount, group.currency)} in ${group.name}`,
        });
        remindersSent++;
      }
    }

    return res.status(200).json({ groupsChecked: groups.length, remindersSent });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
