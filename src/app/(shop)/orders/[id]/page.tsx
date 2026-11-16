import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderDetailScreen, OrderDetailSkeleton } from "@/core/features/orders/order-detail";

export const metadata: Metadata = { title: "Order" };

type Params = Promise<{ id: string }>;

async function OrderFromParams({ params }: { params: Params }) {
  const { id } = await params;
  return <OrderDetailScreen id={id} />;
}

/** The order id is only known per request, so reading it sits inside Suspense (Cache Components). */
export default function OrderPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<OrderDetailSkeleton />}>
      <OrderFromParams params={params} />
    </Suspense>
  );
}
