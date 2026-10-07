import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths so the built game works from any hosting subfolder.
  base: "./",
  build: {
    // Phaser alone is about 1.4 MB (370 KB gzipped) and the game needs all of
    // it before the first screen, so splitting it into chunks would not help.
    chunkSizeWarningLimit: 1600,
  },
});
