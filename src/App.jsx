import { Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import Sidebar from "./components/Sidebar.jsx";
import GroupsList from "./components/GroupsList.jsx";
import GroupDetail from "./components/GroupDetail.jsx";
import AllExpenses from "./components/AllExpenses.jsx";
import AccountSettings from "./components/AccountSettings.jsx";
import InviteAccept from "./components/InviteAccept.jsx";

function AuthedShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

function MainRoutes() {
  return (
    <Routes>
      <Route path="/" element={<GroupsList />} />
      <Route path="/groups/:id" element={<GroupDetail />} />
      <Route path="/expenses" element={<AllExpenses />} />
      <Route path="/settings" element={<AccountSettings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/invite/:token"
        element={
          user ? (
            <AuthedShell>
              <InviteAccept />
            </AuthedShell>
          ) : (
            <AuthScreen />
          )
        }
      />
      <Route
        path="/*"
        element={
          user ? (
            <AuthedShell>
              <MainRoutes />
            </AuthedShell>
          ) : (
            <AuthScreen />
          )
        }
      />
    </Routes>
  );
}
