import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/",               // 🔑 ABSOLUTE paths (required for Shopify iframe)
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
