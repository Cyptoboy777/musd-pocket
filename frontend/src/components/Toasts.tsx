import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { IconAlert, IconCheck, IconInfo, IconX } from "./Icons";

export type ToastKind = "pending" | "success" | "error" | "info";
export type Toast = { id: string; kind: ToastKind; title: string; body?: string; href?: string };

type Ctx = { push: (t: Omit<Toast, "id"> & { id?: string }) => string; dismiss: (id: string) => void };
const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast outside provider");
  return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const push = useCallback<Ctx["push"]>(
    (t) => {
      const id = t.id ?? Math.random().toString(36).slice(2);
      setItems((xs) => [...xs.filter((x) => x.id !== id), { ...t, id }].slice(-3));
      const old = timers.current.get(id);
      if (old) window.clearTimeout(old);
      if (t.kind !== "pending" && t.kind !== "error") {
        timers.current.set(id, window.setTimeout(() => dismiss(id), 5200));
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              className={`toast toast-${t.kind}`}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.16 } }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              role={t.kind === "error" ? "alert" : "status"}
            >
              <span className="toast-icon" aria-hidden="true">
                {t.kind === "pending" ? <span className="spinner" /> : t.kind === "success" ? <IconCheck /> : t.kind === "error" ? <IconAlert /> : <IconInfo />}
              </span>
              <div className="toast-copy">
                <strong>{t.title}</strong>
                {t.body && <span>{t.body}</span>}
                {t.href && (
                  <a href={t.href} target="_blank" rel="noreferrer">
                    View on explorer
                  </a>
                )}
              </div>
              <button className="toast-x" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <IconX width={14} height={14} />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
