import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { groupsApi, expensesApi } from "../utils/api";
import Dashboard from "./Dashboard.jsx";

export default function DashboardPage() {
  const [groups, setGroups] = useState([]);
  const [expensesByGroup, setExpensesByGroup] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    groupsApi
      .list()
      .then(async (data) => {
        setGroups(data);
        const entries = await Promise.all(
          data.map((g) => expensesApi.listForGroup(g.id).then((exps) => [g.id, exps]).catch(() => [g.id, []]))
        );
        setExpensesByGroup(Object.fromEntries(entries));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Link to="/groups" className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline">
          View all groups &rarr;
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No groups yet. <Link to="/groups" className="text-brand-600 dark:text-brand-400 hover:underline">Create one</Link> to start splitting expenses.
        </p>
      ) : (
        <Dashboard groups={groups} expensesByGroup={expensesByGroup} />
      )}
    </div>
  );
}
