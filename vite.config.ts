import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // relative path — Capacitor need this later
  test: {
    include: ["tests/**/*.test.ts"],
  },
} as any);
