import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google-cloud/bigquery"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
