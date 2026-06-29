import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "date-fns",
      "lucide-react",
      "@hugeicons/react",
      "@hugeicons/core-free-icons",
    ],
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
