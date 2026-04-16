import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const sharedSrc = path.resolve(__dirname, "../packages/shared/src");
const superadminRoot = path.resolve(__dirname);

/** Dùng đúng một bản dependency (tránh hai react-router → lỗi useRoutes ngoài <Router>). */
function superadminDep(pkg) {
  return path.resolve(superadminRoot, "node_modules", pkg);
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": sharedSrc,
      react: superadminDep("react"),
      "react-dom": superadminDep("react-dom"),
      "react-router-dom": superadminDep("react-router-dom"),
    },
    dedupe: ["react", "react-dom", "react-router", "react-router-dom"],
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/media": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  envDir: path.resolve(__dirname),
});
