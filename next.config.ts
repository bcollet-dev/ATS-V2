import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["pdf-parse", "pdf-lib"],
};

export default nextConfig;
