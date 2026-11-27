import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this folder (silences the "multiple lockfiles" warning).
  outputFileTracingRoot: projectRoot,
  // Dev runs on Turbopack (next dev --turbopack) for much faster compiles.
  turbopack: { root: projectRoot },
  // Admin forms use Server Actions, which Next.js only accepts from known domains.
  // Behind Cloudflare the forwarded host can differ, so list the real domains.
  experimental: {
    serverActions: {
      allowedOrigins: ["femzyclub.com", "www.femzyclub.com", "*.workers.dev", "localhost:3000"],
      bodySizeLimit: "6mb", // posters can be up to 5 MB
    },
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/**" }]
      : [],
  },
};

export default nextConfig;
