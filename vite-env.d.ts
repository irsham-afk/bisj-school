import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { Button, Card, Field, Input } from "../components/ui";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    const msg = await signIn(email.trim(), password);
    setBusy(false);
    if (msg) setErr("That email and password don't match an account.");
  }

  return (
    <div className="min-h-screen ledger-grid flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="font-mono text-xs tracking-widest text-brand uppercase">Greenfield</div>
          <h1 className="font-display text-3xl text-ink mt-1">School Console</h1>
          <p className="text-sm text-muted mt-1">Sign in to manage students, classes and reports.</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <Input type="email" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)} required placeholder="you@school.edu" />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </Field>
            {err && <p className="text-sm text-danger">{err}</p>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
