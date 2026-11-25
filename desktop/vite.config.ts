import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 개발 모드는 1420 포트를 쓴다 (src-tauri/tauri.conf.json의 devUrl과 같아야 함)
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    // Rust 빌드 폴더(src-tauri/target)를 감시하면 빌드 중 잠긴 파일 때문에 EBUSY로 죽는다
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: { target: "es2021", outDir: "dist" },
});
