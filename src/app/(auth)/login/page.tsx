import type { Metadata } from "next";
import { LoginScreen } from "@/core/features/auth/login";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return <LoginScreen />;
}
