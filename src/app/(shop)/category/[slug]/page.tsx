import type { Metadata } from "next";
import { Suspense } from "react";
import { CategoryListing, ListingSkeleton } from "@/core/features/catalog";

export const metadata: Metadata = { title: "Catalog" };

/** The listing reads the slug with useParams, which suspends under cacheComponents, so it sits in a Suspense boundary. */
export default function CategoryPage() {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <CategoryListing />
    </Suspense>
  );
}
