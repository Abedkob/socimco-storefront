import type { Metadata } from "next";
import { AccountScreen } from "@/core/features/account/account";

export const metadata: Metadata = { title: "Compte" };

export default function AccountPage() {
  return <AccountScreen />;
}
