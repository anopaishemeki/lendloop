import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16.4 otherwise writes AGENTS.md into the repo on every dev start.
  agentRules: false,
  poweredByHeader: false,
};

export default nextConfig;
