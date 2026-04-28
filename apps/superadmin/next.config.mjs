import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(__dirname, "../..");
const sharedSrc = path.join(monorepoRoot, "packages/shared/src");
const sharedCapturePath = path.resolve(sharedSrc, "utils/captureElementToPng.js");
const superadminCaptureBundle = path.resolve(__dirname, "src/lttp-next/captureElementToPng.js");

function resolveHtmlToImagePackageDir() {
  const requireFromConfigFile = createRequire(import.meta.url);
  try {
    return path.dirname(requireFromConfigFile.resolve("html-to-image/package.json"));
  } catch (firstErr) {
    const fallback = path.join(monorepoRoot, "node_modules/html-to-image");
    if (existsSync(path.join(fallback, "package.json"))) {
      return fallback;
    }
    throw new Error(
      `[apps/superadmin/next.config.mjs] Không resolve được html-to-image (${firstErr?.message}). ` +
        `Chạy \`npm install\` tại thư mục gốc repo, kiểm tra lockfile có gói, rồi \`docker compose build ui --no-cache\`.`,
    );
  }
}

const htmlToImagePackageDir = resolveHtmlToImagePackageDir();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@quanluong/shared", "html-to-image"],
  env: {
    ACCESS_TOKEN_COOKIE_NAME: process.env.ACCESS_TOKEN_COOKIE_NAME || "ql.at",
    REFRESH_TOKEN_COOKIE_NAME: process.env.REFRESH_TOKEN_COOKIE_NAME || "ql.rt",
  },
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
    const alias =
      typeof config.resolve.alias === "object" && config.resolve.alias != null && !Array.isArray(config.resolve.alias)
        ? { ...config.resolve.alias }
        : {};
    config.resolve.alias = {
      ...alias,
      "@": sharedSrc,
      [sharedCapturePath]: superadminCaptureBundle,
      "html-to-image": htmlToImagePackageDir,
    };
    config.resolve.modules = [
      path.resolve(monorepoRoot, "node_modules"),
      ...(Array.isArray(config.resolve.modules) ? config.resolve.modules : ["node_modules"]),
    ];
    return config;
  },
  turbopack: {
    resolveAlias: {
      "@": sharedSrc,
      [sharedCapturePath]: superadminCaptureBundle,
      "html-to-image": htmlToImagePackageDir,
    },
  },
};

export default nextConfig;
