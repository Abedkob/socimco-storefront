import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductDetail, ProductDetailSkeleton } from "@/core/features/catalog";

export const metadata: Metadata = { title: "Produit" };

/** The detail view reads the slug with useParams, which suspends under cacheComponents, so it sits in a Suspense boundary. */
export default function ProductPage() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetail />
    </Suspense>
  );
}
