import { type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", end: true, roles: ["admin", "teacher", "staff"] },
  { to: "/students", label: "Students", roles: ["admin"] },
  { to: "/classes", label: "Classes", roles: ["admin"] },
  { to: "/subjects", label: "Subjects", roles: ["admin"] },
  { to: "/grades", label: "Grade levels", roles: ["admin"] },
  { to: "/years", label: "Years & terms", roles: ["admin"] },
  { to: "/events", label: "Events", roles: ["admin"] },
  { to: "/marks", label: "Marks entry", roles: ["admin", "teacher"] },
  { to: "/ptm", label: "PTM entry", roles: ["admin", "teacher"] },
  { to: "/attendance", label: "Attendance & remarks", roles: ["admin", "teacher"] },
  { to: "/reports", label: "Report cards", roles: ["admin"] },
  { to: "/users", label: "Teachers & staff", roles: ["admin"] },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, school, signOut } = useAuth();
  const role = profile?.role ?? "teacher";
  const nav = NAV.filter((n) => n.roles.includes(role));
  const loc = useLocation();
  const current = nav.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="px-5 py-4 border-b border-line">
          <div className="font-mono text-[10px] tracking-widest text-brand uppercase">Console</div>
          <div className="font-display text-lg text-ink leading-tight">{school?.name ?? "School"}</div>
        </div>
        <nav className="flex-1 p-2 overflow-y-auto">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm mb-0.5 ${
                  isActive ? "bg-brand-50 text-brand font-medium" : "text-ink/80 hover:bg-paper"
                }`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-line">
          <div className="px-2 py-1.5 mb-2">
            <div className="text-sm text-ink truncate">{profile?.full_name ?? "—"}</div>
            <div className="font-mono text-[11px] text-muted uppercase">{profile?.role ?? ""}</div>
          </div>
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
