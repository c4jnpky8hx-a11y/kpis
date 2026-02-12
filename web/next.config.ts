import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from scanning parent directories (like HOME) for lockfiles
  outputFileTracingRoot: process.cwd(),
  // Build to /tmp to avoid iCloud Drive file locking
  distDir: '/tmp/.next_testrail_kpis',
};

export default nextConfig;
