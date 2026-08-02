import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ToastHost } from "./components/ui";
import Login from "./auth/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Classes from "./pages/Classes";
import ClassDetail from "./pages/ClassDetail";
import Subjects from "./pages/Subjects";
import SubjectDetail from "./pages/SubjectDetail";
import GradeLevels from "./pages/GradeLevels";
import AcademicYears from "./pages/AcademicYears";
import Users from "./pages/Users";
import TeacherDetail from "./pages/TeacherDetail";
import MarksEntry from "./pages/MarksEntry";
import PtmEntry from "./pages/PtmEntry";
import AttendanceRemarks from "./pages/AttendanceRemarks";
import ReportCards from "./pages/ReportCards";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import Requests from "./pages/Requests";

function Shell() {
  const { session, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  if (!session) return <Login />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/classes/:id" element={<ClassDetail />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/subjects/:id" element={<SubjectDetail />} />
        <Route path="/grades" element={<GradeLevels />} />
        <Route path="/years" element={<AcademicYears />} />
        <Route path="/marks" element={<MarksEntry />} />
        <Route path="/ptm" element={<PtmEntry />} />
        <Route path="/attendance" element={<AttendanceRemarks />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/reports" element={<ReportCards />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<TeacherDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastHost>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </ToastHost>
    </AuthProvider>
  );
}
