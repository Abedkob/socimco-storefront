import type { Metadata } from "next";
import { Suspense } from "react";
import { NegotiationScreen } from "@/core/features/negotiation";

export const metadata: Metadata = { title: "Trade quote" };

/** The screen reads ?id= with useSearchParams, so it renders inside its own Suspense boundary. */
export default function NegotiationPage() {
  return (
    <Suspense fallback={<h1 className="sr-only">Trade quote</h1>}>
      <NegotiationScreen />
    </Suspense>
  );
}
