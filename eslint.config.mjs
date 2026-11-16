import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const TS = "**/*.{ts,tsx}";
const TESTS = ["**/*.test.ts", "**/*.test.tsx"];

const mockBackend = {
  group: ["@/core/mock-backend", "@/core/mock-backend/*", "**/mock-backend", "**/mock-backend/*"],
  message: "Only src/server/backend.ts may choose the backend.",
};
const appLayers = {
  group: ["@/app/*", "@/design/*", "@/server/*"],
  message: "core/ must not depend on app, design or server code.",
};
const serverOnly = {
  group: ["@/core/api/server", "@/core/api/server/*", "**/api/server", "**/api/server/*", "@/core/contract/testing/*"],
  message: "UI and features may only import core/contract, core/api/client and core/ui.",
};
const restrict = (...patterns) => ({ "no-restricted-imports": ["error", { patterns }] });

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    files: [`src/${TS}`],
    ignores: ["src/server/backend.ts", "src/core/mock-backend/**", ...TESTS],
    rules: restrict(mockBackend),
  },
  {
    files: [`src/core/${TS}`],
    ignores: ["src/core/mock-backend/**", ...TESTS],
    rules: restrict(mockBackend, appLayers),
  },
  {
    files: [`src/core/mock-backend/${TS}`],
    rules: restrict(appLayers),
  },
  {
    files: [`src/core/ui/${TS}`, `src/core/features/${TS}`],
    rules: restrict(mockBackend, appLayers, serverOnly),
  },
  {
    // Runs in the browser and talks to the API over HTTP only: no server code, no mock backend.
    files: [`src/core/api/client/${TS}`],
    ignores: TESTS,
    rules: restrict(mockBackend, appLayers, serverOnly),
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
