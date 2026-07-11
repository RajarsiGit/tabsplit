import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { expensesApi } from "../utils/api";
import { useApp } from "../context/AppContext.jsx";

export default function ExpenseComments({ expenseId }) {
  const { user } = useApp();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true);
    expensesApi
      .listComments(expenseId)
      .then(setComments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      await expensesApi.addComment(expenseId, body);
      setBody("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId) {
    setError("");
    try {
      await expensesApi.deleteComment(expenseId, commentId);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">No comments yet.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-start justify-between gap-2">
                <p>
                  <strong>{c.user_name}</strong> <span className="text-gray-400 dark:text-gray-500">&middot; {new Date(c.created_at).toLocaleString()}</span>
                </p>
                {c.user_id === user.id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Remove comment"
                    className="shrink-0 text-xs text-red-500 dark:text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-gray-700 dark:text-gray-300">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment..."
          className="min-w-0 flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={submitting || !body.trim()}
          className="rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
        >
          Post
        </button>
      </form>
    </div>
  );
}

ExpenseComments.propTypes = {
  expenseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
