import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import MyTasksPage from "./pages/MyTasksPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectPage from "./pages/ProjectPage";
import ProjectFormPage from "./pages/ProjectFormPage";
import OpsPage from "./pages/OpsPage";
import ReportsPage from "./pages/ReportsPage";
import MemosPage from "./pages/MemosPage";
import CalendarPage from "./pages/CalendarPage";
import ArchivePage from "./pages/ArchivePage";
import SearchPage from "./pages/SearchPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="empty">불러오는 중…</div>;
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="my" element={<MyTasksPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/new" element={<ProjectFormPage />} />
        <Route path="projects/:id" element={<ProjectPage />} />
        <Route path="projects/:id/edit" element={<ProjectFormPage />} />
        <Route path="ops" element={<OpsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="memos" element={<MemosPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="archive" element={<ArchivePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
