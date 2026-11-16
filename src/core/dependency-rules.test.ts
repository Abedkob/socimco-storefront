import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function restrictedImports(filePath: string, code: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports").length;
}

describe("dependency rules", () => {
  it("stop UI and features from reaching the mock backend or server code", async () => {
    const code = [
      'import { createMockBackend } from "@/core/mock-backend";',
      'import { loadSeed } from "../mock-backend/seed";',
      'import { createApiRoute } from "@/core/api/server";',
      'import { backend } from "@/server/backend";',
      "export const all = [createMockBackend, loadSeed, createApiRoute, backend];",
    ].join("\n");
    expect(await restrictedImports("src/core/ui/example.ts", code)).toBe(4);
    expect(await restrictedImports("src/core/features/cart/example.tsx", code)).toBe(4);
  });

  it("keep the browser API client away from server code and the mock backend", async () => {
    const code = [
      'import { createMockBackend } from "@/core/mock-backend";',
      'import { createApiRoute } from "@/core/api/server";',
      'import { backend } from "@/server/backend";',
      'import { apiRoutes } from "@/core/contract";',
      "export const all = [createMockBackend, createApiRoute, backend, apiRoutes];",
    ].join("\n");
    expect(await restrictedImports("src/core/api/client/example.ts", code)).toBe(3);
  });

  it("allow UI and features to use the contract", async () => {
    const code = 'import { apiRoutes } from "@/core/contract";\nexport const r = apiRoutes;';
    expect(await restrictedImports("src/core/features/example.ts", code)).toBe(0);
  });

  it("let only src/server/backend.ts import the mock backend", async () => {
    const code = 'import { createMockBackend } from "@/core/mock-backend";\nexport const b = createMockBackend;';
    expect(await restrictedImports("src/server/backend.ts", code)).toBe(0);
    expect(await restrictedImports("src/app/page.tsx", code)).toBe(1);
    expect(await restrictedImports("src/design/shell/example.tsx", code)).toBe(1);
  });
});
