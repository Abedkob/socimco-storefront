import { createServerApi } from "@/core/api/server";
import type { ShopBackend } from "@/core/contract";
import { createMockBackend } from "@/core/mock-backend";

// The one place that chooses the backend. Swap createMockBackend() for a real adapter here.
// In `next dev` the mock is kept on globalThis so its data survives hot reloads; it's replaced (and its data
// reset) only when the code adds a new part to the backend, e.g. a new group of routes.
const globalForBackend = globalThis as { __shopBackend?: ShopBackend };
const fresh = createMockBackend();
const cached = globalForBackend.__shopBackend;
export const backend: ShopBackend =
  cached && Object.keys(fresh).every((k) => k in cached) ? cached : (globalForBackend.__shopBackend = fresh);

export const getServerApi = createServerApi(backend);
