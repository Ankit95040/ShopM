import { config as loadEnv } from "@dotenvx/dotenvx";
loadEnv({ convention: "nextjs", quiet: true });
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
