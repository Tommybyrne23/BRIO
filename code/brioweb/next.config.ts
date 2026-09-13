import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(process.env.NEXT_DEV_ALLOWED_ORIGIN ? { allowedDevOrigins: [process.env.NEXT_DEV_ALLOWED_ORIGIN] } : {}),
};

export default nextConfig;
