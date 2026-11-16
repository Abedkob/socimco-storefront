import { describe, expect, it } from "vitest";
import { adapterNameFromEnv, apiConfigFromEnv, qrLoginEnabled } from "./config";

describe("API settings", () => {
  it("defaults to the mock: same origin, cookie auth, contract adapter, QR on", () => {
    expect(apiConfigFromEnv({})).toEqual({ baseUrl: "", auth: "cookie", timeoutMs: 15_000 });
    expect(adapterNameFromEnv(undefined)).toBe("contract");
    expect(qrLoginEnabled(undefined)).toBe(true);
  });

  it("reads the real API's settings", () => {
    expect(
      apiConfigFromEnv({ NEXT_PUBLIC_API_BASE_URL: " https://api.socimco.example/ ", NEXT_PUBLIC_API_AUTH: "bearer", NEXT_PUBLIC_API_TIMEOUT_MS: "8000" }),
    ).toEqual({ baseUrl: "https://api.socimco.example", auth: "bearer", timeoutMs: 8000 });
    expect(adapterNameFromEnv("custom")).toBe("custom");
  });

  it("turns QR sign-in off only with 'off'", () => {
    expect(qrLoginEnabled("off")).toBe(false);
    expect(qrLoginEnabled(" OFF ")).toBe(false);
    expect(qrLoginEnabled("on")).toBe(true);
    expect(qrLoginEnabled("")).toBe(true);
  });
});
