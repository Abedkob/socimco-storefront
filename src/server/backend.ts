import { createServerApi } from "@/core/api/server";
import type { ShopBackend } from "@/core/contract";
import { createMockBackend } from "@/core/mock-backend";

// The one place that chooses the backend. Swap createMockBackend() for a real adapter here.
const globalForBackend = globalThis as { __shopBackend?: ShopBackend };
export const backend: ShopBackend = (globalForBackend.__shopBackend ??= createMockBackend());

export const getServerApi = createServerApi(backend);
