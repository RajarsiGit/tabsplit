import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { groupsApi } from "../utils/api";

export default function GroupSwitcher({ onNavigate }) {
  const location = useLocation();
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState(() => /^\/groups\//.test(location.pathname));

  useEffect(() => {
    groupsApi
      .list()
      .then(setGroups)
      .catch(() => {});
  }, []);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
      >
        Your groups
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="max-h-48 space-y-0.5 overflow-y-auto px-1">
          {groups.length === 0 ? (
            <p className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500">No groups yet</p>
          ) : (
            groups.map((g) => (
              <NavLink
                key={g.id}
                to={`/groups/${g.id}`}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `block truncate rounded-md px-3 py-1.5 text-sm ${
                    isActive
                      ? "bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 font-medium"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`
                }
              >
                {g.name}
              </NavLink>
            ))
          )}
        </div>
      )}
    </div>
  );
}

GroupSwitcher.propTypes = {
  onNavigate: PropTypes.func,
};
