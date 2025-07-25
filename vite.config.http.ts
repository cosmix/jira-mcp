import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/http-server.ts"),
      formats: ["es"],
      fileName: "http-server",
    },
    rollupOptions: {
      external: [
        "@modelcontextprotocol/sdk/server/index.js",
        "@modelcontextprotocol/sdk/server/streamableHttp.js",
        "@modelcontextprotocol/sdk/types.js",
        "node:http",
        "node:stream",
      ],
    },
    target: "node18",
    outDir: "build",
    sourcemap: true,
  },
  plugins: [dts()],
});