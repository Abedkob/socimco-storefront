"use client";

import { useState } from "react";

/** Text-field quantity entry: free typing, committed and clamped on blur or Enter. */
export function useQuantityInput(value: number, min: number, max: number, onCommit: (next: number) => void) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ""), 10);
    setDraft(null);
    if (Number.isNaN(parsed)) return;
    const next = Math.min(max, Math.max(min, parsed));
    if (next !== value) onCommit(next);
  };

  return {
    inputProps: {
      value: draft ?? String(value),
      inputMode: "numeric" as const,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") commit();
        if (e.key === "ArrowUp" && value < max) {
          e.preventDefault();
          onCommit(value + 1);
        }
        if (e.key === "ArrowDown" && value > min) {
          e.preventDefault();
          onCommit(value - 1);
        }
      },
    },
    decrement: () => value > min && onCommit(value - 1),
    increment: () => value < max && onCommit(value + 1),
    canDecrement: value > min,
    canIncrement: value < max,
  };
}
