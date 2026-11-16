import { createApiRoute } from "@/core/api/server";
import { backend } from "@/server/backend";

export const { GET, POST, PATCH, DELETE } = createApiRoute(backend);
