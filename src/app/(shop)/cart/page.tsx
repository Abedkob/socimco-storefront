import type { Metadata } from "next";
import { CartScreen } from "@/core/features/cart";

export const metadata: Metadata = { title: "Votre panier" };

export default function CartPage() {
  return <CartScreen />;
}
