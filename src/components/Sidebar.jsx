import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { accountApi } from "../utils/api";
import NotificationsBell from "./NotificationsBell.jsx";
import GroupSwitcher from "./GroupSwitcher.jsx";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "⌂", end: true },
  { to: "/expenses", label: "All Expenses", icon: "≡" },
  { to: "/settle-up", label: "Settle Up", icon: "⇄" },
  { to: "/recurring", label: "Recurring", icon: "↻" },
  { to: "/activity", label: "Activity", icon: "◔" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

function navLinkClass({ isActive }) {
  return `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-brand-50 dark:bg-brand-900/40 text-brand-700" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100"
  }`;
}

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function UserMenu() {
  const { user, logout } = useApp();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await logout();
  }

  return (
    <div className="relative" ref={containerRef}>
      {open && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-full min-w-[12rem] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg">
          <div className="px-3 py-2">
            <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Appearance</p>
            <div className="flex gap-1 rounded-md border border-gray-200 dark:border-gray-700 p-0.5">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                    theme === opt.value
                      ? "bg-brand-600 text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="block w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            Account settings
          </button>
          <a
            href={accountApi.exportUrl}
            onClick={() => setOpen(false)}
            className="block w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            Export my data
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            Log out
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {initials(user.name) || "?"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</span>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</span>
        </span>
        <span className="shrink-0 text-gray-400 dark:text-gray-500">&#9662;</span>
      </button>
    </div>
  );
}

function SidebarContent({ onNavigate, showBrandHeader = true }) {
  return (
    <div className="flex h-full flex-col">
      {showBrandHeader ? (
        <div className="flex items-center justify-between px-3 py-4">
          <NavLink
            to="/"
            onClick={onNavigate}
            className="flex items-center gap-2 text-lg font-bold text-brand-600 dark:text-brand-400"
          >
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            TabSplit
          </NavLink>
          <NotificationsBell align="left" />
        </div>
      ) : (
        <div className="flex justify-end px-3 py-4">
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close menu"
            className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            &#10005;
          </button>
        </div>
      )}

      <nav className="space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={navLinkClass}>
            <span aria-hidden="true" className="text-base">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 flex-1 overflow-y-auto px-3">
        <GroupSwitcher onNavigate={onNavigate} />
      </div>

      <div className="px-3 pb-4 pt-2">
        <UserMenu />
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          &#9776;
        </button>
        <NavLink to="/" className="flex items-center gap-2 text-base font-bold text-brand-600 dark:text-brand-400">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          TabSplit
        </NavLink>
        <NotificationsBell />
      </header>

      <aside className="hidden w-64 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sm:fixed sm:inset-y-0 sm:left-0 sm:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} showBrandHeader={false} />
          </aside>
        </div>
      )}
    </>
  );
}
