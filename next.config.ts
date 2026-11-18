import type { NextConfig } from "next";

const config: NextConfig = {
  // public/data is ~180 MB of JSON. It is served as static files and must never
  // be bundled into a serverless function (see lib/data.ts).
  outputFileTracingExcludes: { "*": ["public/data/**", "pipeline/**"] },
};

export default config;
