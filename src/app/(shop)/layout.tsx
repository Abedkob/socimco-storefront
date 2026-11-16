import type { ReactNode } from "react";
import { AuthGate } from "@/core/features/auth/auth-gate";
import { Shell } from "@/design/shell";

/** Every shop page: signed-in customers only, inside the SOCIMCO header, nav and footer. */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <Shell>{children}</Shell>
    </AuthGate>
  );
}
