import {
  createContext, useContext, useState, useCallback, type ReactNode,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes,
} from "react";

/* ---------- Button ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};
export function Button({ variant = "primary", className = "", ...p }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    ghost: "bg-transparent text-ink border border-line hover:bg-paper",
    danger: "bg-transparent text-danger border border-danger/30 hover:bg-danger/5",
  }[variant];
  return <button className={`${base} ${styles} ${className}`} {...p} />;
}

/* ---------- Card ---------- */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface border border-line rounded-md shadow-card ${className}`}>{children}</div>;
}

/* ---------- Field + Input + Select ---------- */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}
const fieldCls =
  "w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-brand";
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldCls} ${p.className ?? ""}`} {...p} />;
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${fieldCls} ${p.className ?? ""}`} {...p} />;
}

/* ---------- Modal ---------- */
export function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/30 p-4 pt-[10vh]" onClick={onClose}>
      <div className="w-full max-w-md bg-surface rounded-lg shadow-pop border border-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-display text-lg text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Table ---------- */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
            {head.map((h) => <th key={h} className="font-medium px-4 py-2.5 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

/* ---------- Empty state ---------- */
export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="text-center py-14 px-6">
      <p className="font-display text-lg text-ink">{title}</p>
      <p className="text-sm text-muted mt-1">{hint}</p>
    </div>
  );
}

/* ---------- Toast ---------- */
type Toast = { id: number; msg: string; kind: "ok" | "error" };
const ToastCtx = createContext<(msg: string, kind?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] space-y-2">
        {items.map((t) => (
          <div key={t.id}
            className={`rounded-md px-4 py-2.5 text-sm text-white shadow-pop ${t.kind === "ok" ? "bg-brand" : "bg-danger"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
