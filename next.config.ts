import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/clerk/:path*",
        destination: "https://frontend-api.clerk.services/:path*",
      },
    ];
  },
};

export default nextConfig;
