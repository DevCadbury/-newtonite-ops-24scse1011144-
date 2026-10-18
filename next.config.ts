import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent webpack/turbopack from bundling these Node.js-only packages
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "pg-native",
    "bcryptjs",
  ],
  // Suppress deprecation warnings for middleware (we know about the proxy rename)
  // This prevents turbopack from warning about middleware file convention
};

export default nextConfig;
