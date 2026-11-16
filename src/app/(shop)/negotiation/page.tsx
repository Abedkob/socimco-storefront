import type { Metadata } from "next";
import { Suspense } from "react";
import { NegotiationScreen } from "@/core/features/negotiation";

export const metadata: Metadata = { title: "Devis" };

/** The screen reads ?id= with useSearchParams, so it renders inside its own Suspense boundary. */
export default function NegotiationPage() {
  return (
    <Suspense fallback={<h1 className="sr-only">Devis</h1>}>
      <NegotiationScreen />
    </Suspense>
  );
}
