import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["date-fns", "lucide-react"],
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
