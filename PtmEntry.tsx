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
    { label: "Active students", key: "students" as const },
    { label: "Classes", key: "classes" as const },
    { label: "Subjects", key: "subjects" as const },
    { label: "Teachers", key: "teachers" as const },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tiles.map((t) => (
        <Card key={t.key} className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted">{t.label}</div>
          <div className="font-mono text-4xl text-brand mt-2">
            {loading ? "—" : data?.[t.key]}
          </div>
        </Card>
      ))}
    </div>
  );
}
