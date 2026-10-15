import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Miniaturas das transmissões do YouTube na página de Transmissão.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }],
  },
  partialPrefetching: true,
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
