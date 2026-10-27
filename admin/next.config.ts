import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The admin panel and the API read live data on every request, so the
  // Cache Components model (explicit `use cache` + Suspense everywhere)
  // only gets in the way here.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
