import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useFetch } from "../lib/useFetch";
import { useAuth } from "../auth/AuthProvider";
import type { GradeLevel } from "../lib/types";
import { Button, Card, Empty, Field, Input, Modal, Table, useToast } from "../components/ui";

export default function GradeLevels() {
  const { profile } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", level_order: "" });
  const [busy, setBusy] = useState(false);

  const { data, loading, refetch } = useFetch<GradeLevel[]>(async () => {
    const { data, error } = await supabase.from("grade_levels").select("*").order("level_order");
    if (error) throw error;
    return data as GradeLevel[];
  });

  async function save() {
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from("grade_levels").insert({
      school_id: profile.school_id, name: form.name, level_order: Number(form.level_order) || 0,
    });
    setBusy(false);
    if (error) { toast(error.message, "error"); return; }
    toast("Grade level added"); setOpen(false); setForm({ name: "", level_order: "" }); refetch();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}>Add grade level</Button></div>
      <Card>
        {loading ? <Empty title="Loading…" hint="" />
          : !data || data.length === 0 ? <Empty title="No grade levels yet" hint="Add the grades your school runs, in order." />
          : (
            <Table head={["Order", "Grade level"]}>
              {data.map((g) => (
                <tr key={g.id} className="hover:bg-paper/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">{g.level_order}</td>
                  <td className="px-4 py-2.5">{g.name}</td>
                </tr>
              ))}
            </Table>
          )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add grade level">
        <div className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Grade 7" /></Field>
          <Field label="Order (for sorting / promotion)">
            <Input type="number" value={form.level_order} onChange={(e) => setForm({ ...form, level_order: e.target.value })} placeholder="7" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !form.name}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
