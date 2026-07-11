import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { accountApi, authApi } from "../utils/api";

const GITHUB_MESSAGES = {
  github: "GitHub connection failed. Please try again.",
  github_no_email: "Your GitHub account has no verified email address to connect with.",
  github_taken: "That GitHub account is already connected to a different TabSplit account.",
};

export default function AccountSettings() {
  const { user, logout, refreshUser } = useApp();
  const navigate = useNavigate();

  const [githubNotice, setGithubNotice] = useState("");
  const [githubError, setGithubError] = useState("");

  const [name, setName] = useState(user.name);
  const [profileError, setProfileError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [githubBusy, setGithubBusy] = useState(false);

  const [mode, setMode] = useState("own");
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linked = params.get("linked");
    const authError = params.get("authError");

    if (linked === "github") {
      setGithubNotice("GitHub account connected.");
      refreshUser();
    }
    if (authError) {
      setGithubError(GITHUB_MESSAGES[authError] || "GitHub connection failed. Please try again.");
    }
    if (linked || authError) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refreshUser]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError("");
    try {
      await authApi.updateProfile(name);
      await refreshUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (err) {
      setProfileError(err.message);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation don't match");
      return;
    }

    try {
      await authApi.updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err) {
      setPasswordError(err.message);
    }
  }

  async function handleUnlinkGithub() {
    setGithubError("");
    setGithubBusy(true);
    try {
      await authApi.unlinkGithub();
      await refreshUser();
    } catch (err) {
      setGithubError(err.message);
    } finally {
      setGithubBusy(false);
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    if (confirmText !== "DELETE") return;

    setDeleteError("");
    setDeleting(true);
    try {
      await accountApi.delete(mode);
      await logout();
      navigate("/");
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
          &larr; Back to groups
        </Link>
        <h1 className="text-xl font-bold">Account settings</h1>
        <p className="mt-1 text-sm text-gray-500">{user.email}</p>
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="font-semibold">Profile</h2>
        <div>
          <label htmlFor="account-name" className="mb-1 block text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id="account-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        {profileError && <p className="text-sm text-red-600">{profileError}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Save name
          </button>
          {profileSaved && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </form>

      <form
        onSubmit={handleChangePassword}
        className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h2 className="font-semibold">{user.has_password ? "Change password" : "Set a password"}</h2>
        {!user.has_password && (
          <p className="text-xs text-gray-500">
            Your account currently only signs in with GitHub. Set a password to also enable
            email/password login.
          </p>
        )}
        {user.has_password && (
          <div>
            <label htmlFor="current-password" className="mb-1 block text-sm font-medium text-gray-700">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-gray-700">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {user.has_password ? "Update password" : "Set password"}
          </button>
          {passwordSaved && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </form>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Connected accounts</h2>
        {githubNotice && <p className="text-sm text-green-600">{githubNotice}</p>}
        {githubError && <p className="text-sm text-red-600">{githubError}</p>}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">GitHub</p>
            <p className="text-xs text-gray-500">
              {user.has_github ? "Connected" : "Not connected"}
            </p>
          </div>
          {user.has_github ? (
            <button
              type="button"
              disabled={githubBusy || !user.has_password}
              onClick={handleUnlinkGithub}
              title={!user.has_password ? "Set a password above before disconnecting GitHub" : undefined}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Disconnect
            </button>
          ) : (
            <a
              href={authApi.githubLoginUrl}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
            >
              Connect GitHub
            </a>
          )}
        </div>
        {user.has_github && !user.has_password && (
          <p className="text-xs text-gray-500">
            Set a password above before disconnecting GitHub, or you'll be locked out.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-1 font-semibold">Export your data</h2>
        <p className="mb-3 text-sm text-gray-500">
          Download a JSON file of your groups, expenses, splits, recurring templates, and
          settlements.
        </p>
        <a
          href={accountApi.exportUrl}
          download="tabsplit-export.json"
          className="inline-block rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Export my data
        </a>
      </div>

      <div className="rounded-lg border border-red-200 bg-white p-4">
        <h2 className="mb-1 font-semibold text-red-700">Danger zone</h2>
        <p className="mb-4 text-sm text-gray-500">
          Deleting your account is permanent and cannot be undone.
        </p>

        <form onSubmit={handleDeleteAccount} className="space-y-4">
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

          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

          <button
            type="submit"
            disabled={confirmText !== "DELETE" || deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Delete my account
          </button>
        </form>
      </div>
    </div>
  );
}
