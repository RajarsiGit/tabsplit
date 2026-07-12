import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { notificationsApi } from "../utils/api";

export default function GroupActivity({ groupId }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    notificationsApi
      .listForGroup(groupId, 100)
      .then(setActivity)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [groupId]);

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : activity.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {activity.map((a) => (
            <li key={a.id} className="text-sm">
              <p>{a.message}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(a.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

GroupActivity.propTypes = {
  groupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
