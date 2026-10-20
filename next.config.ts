import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async rewrites() {
    return [
      {
        source: "/graphql",
        destination: process.env.GRAPHQL_BACKEND_URL ?? "http://localhost:4000/graphql",
      },
    ];
  },
};

export default nextConfig;
