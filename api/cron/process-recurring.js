import { getDb } from "../_lib/db.js";
import { splitEqually } from "../expenses.js";
import { nextOccurrence } from "../_lib/recurrence.js";

// Vercel Cron job (see vercel.json "crons") - runs daily and materializes any
// recurring expense templates that are due, then advances their next_occurrence.
export default async function handler(req, res) {
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const sql = getDb();

  try {
    const due = await sql`
      SELECT * FROM recurring_expenses
      WHERE active = TRUE AND next_occurrence <= CURRENT_DATE
    `;

    const created = [];

    for (const template of due) {
      const members = await sql`
        SELECT user_id FROM group_members WHERE group_id = ${template.group_id}
      `;

      if (members.length === 0) continue;

      const expenseResult = await sql`
        INSERT INTO expenses (group_id, paid_by, created_by, recurring_expense_id, description, amount, category, split_type, expense_date)
        VALUES (${template.group_id}, ${template.paid_by}, ${template.paid_by}, ${template.id}, ${template.description}, ${template.amount}, ${template.category}, 'equal', ${template.next_occurrence})
        RETURNING id
      `;

      const expenseId = expenseResult[0].id;

      await sql`
        INSERT INTO expense_payments (expense_id, user_id, amount)
        VALUES (${expenseId}, ${template.paid_by}, ${template.amount})
      `;

      const splits = splitEqually(
        Number(template.amount),
        members.map((m) => m.user_id)
      );

      for (const split of splits) {
        await sql`
          INSERT INTO expense_splits (expense_id, user_id, share_amount)
          VALUES (${expenseId}, ${split.userId}, ${split.shareAmount})
        `;
      }

      const next = nextOccurrence(
        new Date(template.next_occurrence).toISOString().slice(0, 10),
        template.frequency
      );

      await sql`
        UPDATE recurring_expenses SET next_occurrence = ${next} WHERE id = ${template.id}
      `;

      created.push(expenseId);
    }

    return res.status(200).json({ processed: due.length, createdExpenseIds: created });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
