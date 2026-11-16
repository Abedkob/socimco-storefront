import type { Metadata } from "next";
import { StatusScreen } from "@/core/features/status/status-screen";

export const metadata: Metadata = { title: "Page not found" };

/** Any unmatched URL, and notFound() anywhere in the app. Shown without the shop header (it may be a signed-out visitor). */
export default function NotFound() {
  return <StatusScreen kind="404" standalone />;
}
