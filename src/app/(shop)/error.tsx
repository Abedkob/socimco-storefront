"use client";

import { StatusScreen } from "@/core/features/status/status-screen";

/** Unexpected errors in a shop page. Sits below the shop layout, so the header, cart and footer stay usable. */
export default function ShopError({ retry }: { error: unknown; retry: () => void }) {
  return <StatusScreen kind="error" onRetry={retry} />;
}
