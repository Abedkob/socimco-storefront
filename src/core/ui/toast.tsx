"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastTone = "success" | "info" | "danger";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  notify(message: string, tone?: ToastTone): void;
}

const ToastContext = createContext<ToastApi | null>(null);
const ToastListContext = createContext<{ toasts: ToastItem[]; dismiss: (id: number) => void }>({ toasts: [], dismiss: () => {} });

/** App-wide toasts: at most three at once, each auto-dismissed after ~4 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const next = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = ++next.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), 3800);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ notify }), [notify]);
  const list = useMemo(() => ({ toasts, dismiss }), [toasts, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      <ToastListContext.Provider value={list}>{children}</ToastListContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

/** Renders the toast stack. Sits above the mobile floating nav and buy bars. */
export function Toaster() {
  const { toasts, dismiss } = useContext(ToastListContext);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[150px] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
      {toasts.map((t) => {
        const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "danger" ? XCircle : Info;
        return (
          <div key={t.id} role="status" className="toast-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[20px] bg-dark py-2 pl-4 pr-2 text-sm text-on-dark shadow-2xl">
            <Icon size={18} className={t.tone === "danger" ? "shrink-0 text-[#ff8a80]" : "shrink-0 text-accent"} aria-hidden />
            <p className="flex-1 py-1.5">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} className="grid size-10 shrink-0 place-items-center rounded-full text-on-dark-2 hover:bg-dark-2 hover:text-on-dark" aria-label="Fermer">
              <X size={16} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
