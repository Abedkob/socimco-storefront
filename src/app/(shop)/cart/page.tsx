import type { Metadata } from "next";
import { CartScreen } from "@/core/features/cart";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return <CartScreen />;
}
