import type { Metadata } from "next";
import { Suspense } from "react";
import { QrApproveFallback, QrApproveScreen } from "@/core/features/auth/qr-approve";

export const metadata: Metadata = { title: "Autoriser un ordinateur" };

/** Opened on the phone by scanning the computer's sign-in code (?code=…). */
export default function QrApprovePage() {
  return (
    <Suspense fallback={<QrApproveFallback />}>
      <QrApproveScreen />
    </Suspense>
  );
}
