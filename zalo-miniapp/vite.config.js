import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import zaloMiniApp from "zmp-vite-plugin";
import react from "@vitejs/plugin-react";

const projectDir = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default () => {
  return defineConfig({
    root: "./src",
    envDir: projectDir,
    base: "",
    plugins: [zaloMiniApp(), react()],
    build: {
      assetsInlineLimit: 0,
    },
  });
};
