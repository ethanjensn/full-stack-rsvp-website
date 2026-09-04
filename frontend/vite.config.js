import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "/static/",
  build: {
    outDir: resolve(__dirname, "../static"),
    assetsDir: "build-assets",
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/calendar": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      "/calendar.ics": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
