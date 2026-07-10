import { Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import Navbar from "./components/Navbar.jsx";
import GroupsList from "./components/GroupsList.jsx";
import GroupDetail from "./components/GroupDetail.jsx";

export default function App() {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <Routes>
          <Route path="/" element={<GroupsList />} />
          <Route path="/groups/:id" element={<GroupDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
