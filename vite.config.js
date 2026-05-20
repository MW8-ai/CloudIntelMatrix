import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "/cloud-matrix/",   // ← change to your repo name
  build: { outDir: "dist", emptyOutDir: true },
});
