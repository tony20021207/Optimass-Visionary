import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    "@optimass/anatomy-kb",
    "@optimass/db",
    "@optimass/diagnostics",
    "@optimass/exercise-rating",
    "@optimass/kinematics",
    "@optimass/pose-capture",
    "@optimass/program-builder",
    "@optimass/types",
    "@optimass/ui",
  ],
};

export default nextConfig;
