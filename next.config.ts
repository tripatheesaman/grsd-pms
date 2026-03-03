import type { NextConfig } from "next";

const rawBasePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim();
const basePath =
  rawBasePath.length === 0
    ? "/pms"
    : (rawBasePath.startsWith("/") ? rawBasePath : `/${rawBasePath}`).replace(
        /\/+$/,
        "",
      );

const nextConfig: NextConfig = {
  basePath,
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
