import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useFetch } from "../lib/useFetch";
import { Card } from "../components/ui";

async function count(table: string, filter?: (q: any) => any) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c ?? 0;
}

export default function Dashboard() {
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

  const actions = [
    { label: "New exam / PTM", hint: "Open an event for a term", to: "/events" },
    { label: "Enter marks", hint: "Go to marks entry", to: "/marks" },
    { label: "Generate reports", hint: "Report cards & Excel", to: "/reports" },
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((a) => (
            <Link key={a.to} to={a.to} className="block">
              <Card className="p-4 hover:border-brand transition-colors cursor-pointer">
                <div className="font-medium">{a.label}</div>
                <div className="text-xs text-muted mt-1">{a.hint}</div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
