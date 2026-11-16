import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The shop waits for the signed-in customer before rendering, and its data loads in the browser from the
    // API, so pages can't render "instantly" from the server. Validate only segments that opt in with
    // `export const instant = true`, instead of reporting every shop page as "dropped from rendering" in dev.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    // This folder is the project root, even if a stray lockfile sits in a parent folder.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
