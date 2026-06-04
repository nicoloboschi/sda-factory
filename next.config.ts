import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root — there are sibling lockfiles under ~/dev that would
  // otherwise make Next infer the wrong root.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  // node-pty is a native addon (ships a spawn-helper binary). Bundling it breaks
  // posix_spawn; keep it external so it loads from node_modules at runtime.
  serverExternalPackages: ["node-pty"],
};

export default nextConfig;
