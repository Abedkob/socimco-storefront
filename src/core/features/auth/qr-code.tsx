"use client";

import { QRCodeSVG } from "qrcode.react";

/** The green SOCIMCO "S" tile in the middle of the code (error correction "H" keeps it scannable). */
const CENTRE_MARK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" rx="2.4" fill="#35b335"/>' +
      '<text x="5" y="7.2" text-anchor="middle" font-family="Arial,sans-serif" font-size="6.8" font-weight="800" fill="#ffffff">S</text></svg>',
  );

/** Draws the scannable sign-in code for `value` (the approve URL from the API). */
export function QrCode({ value, dim = false }: { value: string; dim?: boolean }) {
  return (
    <QRCodeSVG
      value={value}
      size={256}
      level="H"
      marginSize={2}
      bgColor="#ffffff"
      fgColor="#06163d"
      imageSettings={{ src: CENTRE_MARK, width: 52, height: 52, excavate: true }}
      role="img"
      aria-label="QR code de connexion"
      data-value={value}
      style={{ width: "100%", height: "100%", borderRadius: 10 }}
      className={`transition-[filter,opacity] duration-300 motion-reduce:transition-none ${dim ? "opacity-25 blur-[3px]" : ""}`}
    />
  );
}
