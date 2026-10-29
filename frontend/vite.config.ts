import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // maplibre is most of the bundle and changes rarely; a separate chunk caches independently
        codeSplitting: {
          groups: [{ name: "maplibre", test: /node_modules[\\/]maplibre-gl/ }],
        },
      },
    },
    // maplibre-gl alone is ~800 kB minified and cannot be split further
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      // the django dev server; VITE_API_BASE_URL stays empty so requests are same-origin
      "/api": "http://localhost:8000",
    },
  },
});
