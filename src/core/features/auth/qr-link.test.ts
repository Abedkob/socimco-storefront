import { describe, expect, it } from "vitest";
import { codeFromScan, QR_PATHS } from "./qr-link";

const ORIGIN = "https://socimco-storefront.vercel.app";

describe("codeFromScan", () => {
  it("reads the code from this site's approve link", () => {
    expect(codeFromScan(`${ORIGIN}/qr/approve?code=AbC-123_x`, ORIGIN)).toBe("AbC-123_x");
    expect(codeFromScan(`  ${ORIGIN}/qr/approve?code=%2Bplus%3D  `, ORIGIN)).toBe("+plus=");
  });

  it("reads phone sign-in links only when asked for them", () => {
    const link = `${ORIGIN}/qr/sign-in?code=xyz`;
    expect(codeFromScan(link, ORIGIN, QR_PATHS.signInPhone)).toBe("xyz");
    expect(codeFromScan(link, ORIGIN, QR_PATHS.approveComputer)).toBeNull();
    expect(codeFromScan(`${ORIGIN}/qr/approve?code=abc`, ORIGIN, QR_PATHS.signInPhone)).toBeNull();
  });

  it("rejects links to other sites, other pages, and links without a code", () => {
    expect(codeFromScan("https://evil.example/qr/approve?code=abc", ORIGIN)).toBeNull();
    expect(codeFromScan(`${ORIGIN}/login?code=abc`, ORIGIN)).toBeNull();
    expect(codeFromScan(`${ORIGIN}/evil/qr/approve?code=abc`, ORIGIN)).toBeNull();
    expect(codeFromScan(`${ORIGIN}/qr/approve`, ORIGIN)).toBeNull();
    expect(codeFromScan(`${ORIGIN}/qr/approve?code=%20`, ORIGIN)).toBeNull();
  });

  it("rejects anything that isn't a URL", () => {
    expect(codeFromScan("hello", ORIGIN)).toBeNull();
    expect(codeFromScan("", ORIGIN)).toBeNull();
  });
});
