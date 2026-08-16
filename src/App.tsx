import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
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
import Users from "./pages/Users";
import TeacherDetail from "./pages/TeacherDetail";
import MarksEntry from "./pages/MarksEntry";
import PtmEntry from "./pages/PtmEntry";
import AttendanceRemarks from "./pages/AttendanceRemarks";
import ReportCards from "./pages/ReportCards";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import Promotion from "./pages/Promotion";
import Requests from "./pages/Requests";
import Account from "./pages/Account";
import ErrorBoundary from "./components/ErrorBoundary";

function Protected({ roles, children }: { roles: string[]; children: JSX.Element }) {
  const { profile } = useAuth();
  if (profile && !roles.includes(profile.role)) return <Navigate to="/" replace />;
  return children;
}
const ADMIN = ["admin"];
const TEACHER = ["teacher"];
const BOTH = ["admin", "teacher", "staff"];

function Shell() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const wasAuthed = useRef(false);
  useEffect(() => {
    if (session && !wasAuthed.current) { wasAuthed.current = true; navigate("/", { replace: true }); }
    if (!session) wasAuthed.current = false;
  }, [session]);

  if (loading) return <div className="p-8 text-muted">Loading…</div>;
  if (!session) return <Login />;
  return (
    <Layout>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/account" element={<Account />} />
        <Route path="/students" element={<Protected roles={ADMIN}><Students /></Protected>} />
        <Route path="/classes" element={<Protected roles={ADMIN}><Classes /></Protected>} />
        <Route path="/classes/:id" element={<Protected roles={ADMIN}><ClassDetail /></Protected>} />
        <Route path="/subjects" element={<Protected roles={ADMIN}><Subjects /></Protected>} />
        <Route path="/subjects/:id" element={<Protected roles={ADMIN}><SubjectDetail /></Protected>} />
        <Route path="/grades" element={<Protected roles={ADMIN}><GradeLevels /></Protected>} />
        <Route path="/promotion" element={<Protected roles={ADMIN}><Promotion /></Protected>} />
        <Route path="/events" element={<Protected roles={ADMIN}><Events /></Protected>} />
        <Route path="/events/:id" element={<Protected roles={ADMIN}><EventDetail /></Protected>} />
        <Route path="/reports" element={<Protected roles={ADMIN}><ReportCards /></Protected>} />
        <Route path="/users" element={<Protected roles={ADMIN}><Users /></Protected>} />
        <Route path="/users/:id" element={<Protected roles={ADMIN}><TeacherDetail /></Protected>} />
        <Route path="/marks" element={<Protected roles={TEACHER}><MarksEntry /></Protected>} />
        <Route path="/ptm" element={<Protected roles={TEACHER}><PtmEntry /></Protected>} />
        <Route path="/attendance/:eventId" element={<Protected roles={TEACHER}><AttendanceRemarks /></Protected>} />
        <Route path="/requests" element={<Protected roles={BOTH}><Requests /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
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
