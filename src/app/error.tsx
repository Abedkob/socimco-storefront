"use client";

import { StatusScreen } from "@/core/features/status/status-screen";

/** Unexpected errors outside the shop pages (sign-in, phone approval). Shop pages have their own boundary that keeps the header. */
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return <StatusScreen kind="error" onRetry={retry} standalone />;
}
