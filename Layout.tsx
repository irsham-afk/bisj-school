import { type ReactNode } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "./ui";

type Item = { to: string; label: string; end?: boolean; roles: string[]; group: string };

const NAV: Item[] = [
  { to: "/", label: "Dashboard", end: true, roles: ["admin", "teacher", "staff"], group: "" },
  // admin: the core loop
  { to: "/events", label: "Exams & PTM", roles: ["admin"], group: "Every term" },
  { to: "/reports", label: "Report cards & Excel", roles: ["admin"], group: "Every term" },
  // teacher: entry
  { to: "/marks", label: "Marks entry", roles: ["teacher"], group: "Enter" },
  { to: "/ptm", label: "PTM entry", roles: ["teacher"], group: "Enter" },
  // requests — both roles (admin=inbox, teacher=form)
  { to: "/requests", label: "Access requests", roles: ["admin", "teacher"], group: "Requests" },
  // admin: setup
  { to: "/students", label: "Students", roles: ["admin"], group: "Setup" },
  { to: "/classes", label: "Classes", roles: ["admin"], group: "Setup" },
  { to: "/subjects", label: "Subjects", roles: ["admin"], group: "Setup" },
  { to: "/grades", label: "Grade levels", roles: ["admin"], group: "Setup" },
  { to: "/promotion", label: "Promote students", roles: ["admin"], group: "Setup" },
  { to: "/users", label: "Teachers & staff", roles: ["admin"], group: "Setup" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, school, signOut } = useAuth();
  const role = profile?.role ?? "teacher";
  const nav = NAV.filter((n) => n.roles.includes(role));
  const loc = useLocation();
  const current = nav.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));

  let lastGroup = "";
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="px-5 py-4 border-b border-line">
          <div className="font-display text-lg text-ink leading-tight">{school?.name ?? "School"}</div>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {nav.map((n) => {
            const showHeading = n.group && n.group !== lastGroup;
            lastGroup = n.group;
            return (
              <div key={n.to}>
                {showHeading && <div className="px-3 pt-4 pb-1 text-[10px] font-mono uppercase tracking-widest text-muted/70">{n.group}</div>}
                <NavLink to={n.to} end={n.end}
                  className={({ isActive }) => `block rounded px-3 py-2 text-sm mb-0.5 ${isActive ? "bg-brand-50 text-brand font-medium" : "text-ink/80 hover:bg-paper"}`}>
                  {n.label}
                </NavLink>
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-line">
          <Link to="/account" className="block px-2 py-1.5 mb-2 rounded hover:bg-paper">
            <div className="text-sm text-ink truncate">{profile?.full_name ?? "—"}</div>
            <div className="font-mono text-[11px] text-muted uppercase">{profile?.role ?? ""} · my account</div>
          </Link>
          <Button variant="ghost" className="w-full" onClick={signOut}>Sign out</Button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-line bg-surface flex items-center px-6">
          <h1 className="font-display text-xl text-ink">{current?.label ?? ""}</h1>
        </header>
        <main className="flex-1 p-6 max-w-6xl w-full">{children}</main>
      </div>
    </div>
  );
}
