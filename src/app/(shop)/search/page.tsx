import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingSkeleton, SearchListing } from "@/core/features/catalog";

export const metadata: Metadata = { title: "Recherche" };

/** useSearchParams needs a Suspense boundary. */
export default function SearchPage() {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <SearchListing />
    </Suspense>
  );
}
