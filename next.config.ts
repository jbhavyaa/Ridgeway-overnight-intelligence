import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack instead of Turbopack (native SWC not available on this platform)
  turbopack: undefined,
};

export default nextConfig;
