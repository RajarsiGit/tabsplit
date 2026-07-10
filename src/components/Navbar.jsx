import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";

export default function Navbar() {
  const { user, logout } = useApp();

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-lg font-bold text-brand-600">
          TabSplit
        </Link>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{user.name}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
