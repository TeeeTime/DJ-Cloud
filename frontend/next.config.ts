import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
    output: "standalone",
    env: {
        // In CI, NEXT_PUBLIC_APP_VERSION is set to the release tag (see Dockerfile/deploy.yml).
        // Locally it falls back to the version in package.json.
        NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? pkg.version,
    },
};

export default nextConfig;
