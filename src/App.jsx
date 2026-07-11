import { Routes, Route, Navigate } from "react-router-dom";
import { useApp } from "./context/AppContext.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import Sidebar from "./components/Sidebar.jsx";
import DashboardPage from "./components/DashboardPage.jsx";
import Groups from "./components/Groups.jsx";
import GroupDetail from "./components/GroupDetail.jsx";
import AllExpenses from "./components/AllExpenses.jsx";
import SettleUp from "./components/SettleUp.jsx";
import AllRecurring from "./components/AllRecurring.jsx";
import Activity from "./components/Activity.jsx";
import AccountSettings from "./components/AccountSettings.jsx";
import InviteAccept from "./components/InviteAccept.jsx";

function AuthedShell({ children }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="min-w-0 px-4 py-6 sm:ml-64 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}

function MainRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/groups" element={<Groups />} />
      <Route path="/groups/:id" element={<GroupDetail />} />
      <Route path="/expenses" element={<AllExpenses />} />
      <Route path="/settle-up" element={<SettleUp />} />
      <Route path="/recurring" element={<AllRecurring />} />
      <Route path="/activity" element={<Activity />} />
      <Route path="/settings" element={<AccountSettings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400 dark:text-gray-500">
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
