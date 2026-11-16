import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneSignInFallback, PhoneSignInScreen } from "@/core/features/auth/phone-sign-in";

export const metadata: Metadata = { title: "Connexion par QR code" };

/** Phone, signed out: scan the code a signed-in computer shows (?code=… once scanned). */
export default function PhoneSignInPage() {
  return (
    <Suspense fallback={<PhoneSignInFallback />}>
      <PhoneSignInScreen />
    </Suspense>
  );
}
