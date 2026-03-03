import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/clerk/:path*",
        destination: "https://clerk.gpretire.com/:path*",
      },
    ];
  },
};

export default nextConfig;
