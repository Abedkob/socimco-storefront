import type { Metadata } from "next";
import { CheckoutScreen } from "@/core/features/checkout";

export const metadata: Metadata = { title: "Commande" };

export default function CheckoutPage() {
  return <CheckoutScreen />;
}
