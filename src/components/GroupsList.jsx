import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { groupsApi } from "../utils/api";

export default function GroupsList() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    loadGroups();
  }, []);

  function loadGroups() {
    setLoading(true);
    groupsApi
      .list()
      .then(setGroups)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await groupsApi.create({ name, description });
      setName("");
      setDescription("");
      setShowForm(false);
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Your groups</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {showForm ? "Cancel" : "New group"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div>
            <label htmlFor="group-name" className="mb-1 block text-sm font-medium text-gray-700">
              Group name
            </label>
            <input
              id="group-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apartment 4B, Italy Trip"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="group-description" className="mb-1 block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <input
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Create group
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500">
          No groups yet. Create one to start splitting expenses.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                to={`/groups/${group.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{group.name}</span>
                  <span className="text-xs text-gray-500">
                    {group.member_count} member{group.member_count === "1" ? "" : "s"}
                  </span>
                </div>
                {group.description && (
                  <p className="mt-1 text-sm text-gray-500">{group.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
