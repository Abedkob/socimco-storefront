import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { Providers } from "@/design/providers";
import "./globals.css";

const display = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-app-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-app-sans" });

export const metadata: Metadata = {
  title: { default: "SOCIMCO trade portal", template: "%s · SOCIMCO" },
  description: "SOCIMCO's private trade portal: professional tools, and your own price when you buy by the hundred.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#06163d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="app min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
