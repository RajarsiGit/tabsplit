import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { notificationsApi } from "../utils/api";

export default function Activity() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    notificationsApi
      .list(200)
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    load();
  }

  async function handleClickNotification(n) {
    if (!n.read_at) {
      await notificationsApi.markRead(n.id);
      load();
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Activity</h1>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const content = (
              <div className="min-w-0">
                <p className={n.read_at ? "text-gray-500 dark:text-gray-400" : "font-medium"}>{n.message}</p>
                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            );

            return (
              <li
                key={n.id}
                className={`flex items-center gap-3 rounded-lg border bg-white dark:bg-gray-800 p-4 ${
                  n.read_at ? "border-gray-200 dark:border-gray-700" : "border-brand-200 dark:border-brand-800"
                }`}
              >
                {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />}
                {n.group_id ? (
                  <Link to={`/groups/${n.group_id}`} onClick={() => handleClickNotification(n)} className="min-w-0 flex-1">
                    {content}
                  </Link>
                ) : (
                  <button type="button" onClick={() => handleClickNotification(n)} className="min-w-0 flex-1 text-left">
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
