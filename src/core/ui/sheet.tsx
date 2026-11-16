"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Side = "bottom" | "left" | "right";

const placement: Record<Side, string> = {
  bottom: "sheet-bottom mt-auto mb-0 w-full max-w-none max-h-[88dvh] rounded-t-[var(--sheet-radius,1rem)]",
  left: "sheet-left mr-auto ml-0 h-dvh max-h-none w-[min(88vw,380px)]",
  right: "sheet-right ml-auto mr-0 h-dvh max-h-none w-[min(92vw,440px)]",
};

/**
 * Behaviour-only sheet on the native modal <dialog>: focus stays inside, Escape and backdrop
 * clicks close it, and focus returns to the trigger. Each proposal styles the contents.
 */
export function Sheet({
  open,
  onClose,
  side = "bottom",
  label,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: Side;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={() => {
        document.documentElement.style.overflow = "";
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`sheet-backdrop fixed inset-0 p-0 backdrop:bg-black/45 ${placement[side]} ${className}`}
    >
      {open && children}
    </dialog>
  );
}
