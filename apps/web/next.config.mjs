import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");
const sharedSrc = path.join(monorepoRoot, "packages/shared/src");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@quanluong/shared"],
  env: {
    ACCESS_TOKEN_COOKIE_NAME: process.env.ACCESS_TOKEN_COOKIE_NAME || "ql.at",
    REFRESH_TOKEN_COOKIE_NAME: process.env.REFRESH_TOKEN_COOKIE_NAME || "ql.rt",
  },
  /** Proxy Socket.io khi UI và API cùng origin (NEXT_PUBLIC_API_BASE_URL=/api). Đặt origin backend, vd. http://localhost:3001 */
  async redirects() {
    return [
      {
        source: "/dashboard/lttp-nhap-xuat",
        destination: "/lttp-nhap-xuat",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    const socketOrigin = process.env.NEXT_INTERNAL_API_ORIGIN;
    if (!socketOrigin || String(socketOrigin).trim() === "") {
      return [];
    }
    const base = String(socketOrigin).replace(/\/+$/, "");
    return [{ source: "/socket.io/:path*", destination: `${base}/socket.io/:path*` }];
  },
  webpack: (config) => {
    config.resolve.alias["@"] = sharedSrc;
    return config;
  },
  turbopack: {
    resolveAlias: {
      "@": sharedSrc,
    },
  },
};

export default nextConfig;
