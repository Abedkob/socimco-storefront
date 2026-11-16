"use client";

import type { ReactNode } from "react";
import { ApiProvider } from "@/core/api/client/react";
import { ToastProvider, Toaster } from "@/core/ui";

/** App-wide client providers: the storefront API (React Query) and toasts. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ApiProvider>
      <ToastProvider>
        {children}
        <Toaster />
      </ToastProvider>
    </ApiProvider>
  );
}
