import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import PropTypes from "prop-types";
import { notificationsApi } from "../utils/api";

export default function NotificationsBell({ align = "right" }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  function load() {
    notificationsApi
      .list()
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkRead(id) {
    await notificationsApi.markRead(id);
    load();
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    load();
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative shrink-0 rounded-md border border-gray-300 dark:border-gray-600 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute z-10 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-gray-400 dark:text-gray-500">No notifications yet</li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-gray-50 px-3 py-2 text-sm last:border-b-0 ${
                    n.read_at ? "text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {n.group_id ? (
                    <Link
                      to={`/groups/${n.group_id}`}
                      onClick={() => {
                        setOpen(false);
                        if (!n.read_at) handleMarkRead(n.id);
                      }}
                      className="block hover:underline"
                    >
                      {n.message}
                    </Link>
                  ) : (
                    <span>{n.message}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

NotificationsBell.propTypes = {
  align: PropTypes.oneOf(["left", "right"]),
};
