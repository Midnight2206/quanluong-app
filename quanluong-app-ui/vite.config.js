import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../packages/shared/src"),
    },
  },
  server: {
    proxy: {
      // Gọi API qua cùng origin (vd. VITE_API_BASE_URL=/api) trong dev — tránh "Cannot GET /api/..." về Vite.
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
});

