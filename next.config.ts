import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@google-cloud/bigquery"],
  allowedDevOrigins: ["127.0.0.1", "localhost", "::1"],
};

export default nextConfig;
