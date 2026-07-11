import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { invitesApi } from "../utils/api";

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    invitesApi
      .accept(token)
      .then(({ groupId }) => {
        if (!cancelled) navigate(`/groups/${groupId}`, { replace: true });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="mb-4 text-sm text-red-600">{error}</p>
        <Link to="/" className="text-sm font-medium text-brand-600 hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md text-center text-gray-500">
      <p>Joining group...</p>
    </div>
  );
}
