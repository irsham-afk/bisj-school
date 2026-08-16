import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Button } from "./ui";

type Item = { to: string; label: string; end?: boolean; roles: string[]; group: string };

const NAV: Item[] = [
  { to: "/", label: "Dashboard", end: true, roles: ["admin", "teacher", "staff"], group: "" },
  { to: "/events", label: "Exams & PTM", roles: ["admin"], group: "Every term" },
  { to: "/reports", label: "Report cards & Excel", roles: ["admin"], group: "Every term" },
  { to: "/marks", label: "Marks entry", roles: ["teacher"], group: "Enter" },
  { to: "/ptm", label: "PTM entry", roles: ["teacher"], group: "Enter" },
  { to: "/requests", label: "Access requests", roles: ["admin", "teacher"], group: "Requests" },
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
  const [openMenu, setOpenMenu] = useState(false);

  // close the mobile drawer whenever the route changes
  useEffect(() => { setOpenMenu(false); }, [loc.pathname]);

  let lastGroup = "";
  const sidebar = (
    <aside className={`w-64 shrink-0 border-r border-line bg-surface flex flex-col
        fixed inset-y-0 left-0 z-40 transform transition-transform duration-200
        ${openMenu ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:z-auto`}>
      <div className="px-5 py-4 border-b border-line flex items-center justify-between">
        <div className="font-display text-lg text-ink leading-tight pr-2">{school?.name ?? "School"}</div>
        <button className="md:hidden text-2xl leading-none text-muted" onClick={() => setOpenMenu(false)} aria-label="Close menu">×</button>
      </div>
      <nav className="flex-1 p-2 overflow-y-auto">
        {nav.map((n) => {
          const showHeading = n.group && n.group !== lastGroup;
          lastGroup = n.group;
          return (
            <div key={n.to}>
              {showHeading && <div className="px-3 pt-4 pb-1 text-[10px] font-mono uppercase tracking-widest text-muted/70">{n.group}</div>}
              <NavLink to={n.to} end={n.end}
                className={({ isActive }) => `block rounded px-3 py-2.5 text-sm mb-0.5 ${isActive ? "bg-brand-50 text-brand font-medium" : "text-ink/80 hover:bg-paper"}`}>
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
  );

  return (
    <div className="min-h-screen md:flex">
      {/* backdrop on mobile when the drawer is open */}
      {openMenu && <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setOpenMenu(false)} />}
      {sidebar}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-line bg-surface flex items-center gap-3 px-4 md:px-6 sticky top-0 z-20">
          <button className="md:hidden text-2xl leading-none text-ink" onClick={() => setOpenMenu(true)} aria-label="Open menu">☰</button>
          <h1 className="font-display text-lg md:text-xl text-ink truncate">{current?.label ?? ""}</h1>
        </header>
        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full">{children}</main>
      </div>
    </div>
  );
}
