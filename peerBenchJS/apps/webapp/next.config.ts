import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["sharp", "onnxruntime-node", "natural"],
  experimental: {
    serverActions: {
      bodySizeLimit: "1000mb",
    },
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Client-side configuration
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve("crypto-browserify"),
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
