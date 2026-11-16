import type { Metadata } from "next";
import { OrdersScreen } from "@/core/features/orders/orders";

export const metadata: Metadata = { title: "Commandes" };

export default function OrdersPage() {
  return <OrdersScreen />;
}
