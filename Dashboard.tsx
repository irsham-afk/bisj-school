import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../auth/AuthProvider";
import { Card } from "../components/ui";

async function count(table: string, filter?: (q: any) => any) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c ?? 0;
}

function ActionCard({ to, label, hint }: { to: string; label: string; hint: string }) {
  return (
    <Link to={to} className="block">
      <Card className="p-4 hover:border-brand transition-colors cursor-pointer">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted mt-1">{hint}</div>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    // ---- teacher dashboard ----
    const { data } = useFetch(async () => ({
      mine: await count("class_subjects", (q) => q.eq("teacher_id", profile!.id).is("archived_at", null)),
    }));
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl">Welcome, {profile?.full_name?.split(" ")[0] ?? "there"}</h2>
          <p className="text-sm text-muted">You teach {data?.mine ?? "…"} class-subjects. Enter marks under the exam your admin has opened.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ActionCard to="/marks" label="Enter marks" hint="For the current exam" />
          <ActionCard to="/ptm" label="PTM entry" hint="Parent-teacher notes" />
          <ActionCard to="/requests" label="Request subject access" hint="If a class is missing" />
        </div>
      </div>
    );
  }

  // ---- admin dashboard ----
  const { data, loading } = useFetch(async () => ({
    students: await count("students", (q) => q.is("archived_at", null)),
    classes: await count("classes"),
    subjects: await count("subjects"),
    teachers: await count("profiles", (q) => q.eq("role", "teacher")),
  }));
  const tiles = [
    { label: "Active students", key: "students" as const, to: "/students" },
    { label: "Classes", key: "classes" as const, to: "/classes" },
    { label: "Subjects", key: "subjects" as const, to: "/subjects" },
    { label: "Teachers", key: "teachers" as const, to: "/users" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <Link key={t.key} to={t.to} className="block">
            <Card className="p-5 hover:border-brand transition-colors cursor-pointer">
              <div className="text-xs uppercase tracking-wide text-muted">{t.label}</div>
              <div className="font-mono text-4xl text-brand mt-2">{loading ? "—" : data?.[t.key]}</div>
              <div className="text-xs text-brand mt-2">View ›</div>
            </Card>
          </Link>
        ))}
      </div>
      <div>
        <h2 className="font-semibold mb-2">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ActionCard to="/events" label="New exam / PTM" hint="Open an event for a term" />
          <ActionCard to="/reports" label="Report cards & Excel" hint="Generate & download" />
        </div>
      </div>
    </div>
  );
}
