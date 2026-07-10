import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";

export default function Navbar() {
  const { user, logout } = useApp();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="flex shrink-0 items-center gap-2 text-lg font-bold text-brand-600">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          TabSplit
        </Link>
        <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600 sm:gap-4">
          <span className="hidden truncate sm:inline">{user.name}</span>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
