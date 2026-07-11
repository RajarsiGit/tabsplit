import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { accountApi } from "../utils/api";

export default function AccountSettings() {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState("own");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = confirmText === "DELETE";

  async function handleDelete(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setError("");
    setSubmitting(true);
    try {
      await accountApi.delete(mode);
      await logout();
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
          &larr; Back to groups
        </Link>
        <h1 className="text-xl font-bold">Account settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Signed in as {user.name} ({user.email})
        </p>
      </div>

      <div className="rounded-lg border border-red-200 bg-white p-4">
        <h2 className="mb-1 font-semibold text-red-700">Danger zone</h2>
        <p className="mb-4 text-sm text-gray-500">
          Deleting your account is permanent and cannot be undone.
        </p>

        <form onSubmit={handleDelete} className="space-y-4">
          <fieldset className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="delete-mode"
                checked={mode === "own"}
                onChange={() => setMode("own")}
                className="mt-1 shrink-0"
              />
              <span>
                <span className="font-medium">Delete only my own records (recommended)</span>
                <br />
                <span className="text-gray-500">
                  You&rsquo;ll leave every group. Any group you solely own is handed off to its
                  longest-standing other member, or deleted if you&rsquo;re the only member. Your
                  name, email, and password are scrubbed and replaced with &ldquo;Deleted
                  user&rdquo;, but shared expenses, splits, and settlements you were part of stay
                  visible to other members instead of disappearing.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="delete-mode"
                checked={mode === "associated"}
                onChange={() => setMode("associated")}
                className="mt-1 shrink-0"
              />
              <span>
                <span className="font-medium">Delete everything associated with me</span>
                <br />
                <span className="text-gray-500">
                  Any group you solely own is deleted entirely &mdash; all its expenses, members,
                  recurring templates, and settlements, for everyone. In groups you don&rsquo;t
                  own, anything you paid for or created is also deleted, though the rest of that
                  group survives.
                </span>
              </span>
            </label>
          </fieldset>

          <div>
            <label htmlFor="confirm-delete" className="mb-1 block text-sm font-medium text-gray-700">
              Type DELETE to confirm
            </label>
            <input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete my account
          </button>
        </form>
      </div>
    </div>
  );
}
