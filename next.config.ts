import { config as loadEnv } from "@dotenvx/dotenvx";
loadEnv({ convention: "nextjs", quiet: true });
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 stable syntax — keep experimental for compatibility
  // @ts-expect-error - serverActions type may still be under experimental in this Next version
  serverActions: {
    bodySizeLimit: "5mb",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
