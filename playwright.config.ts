import { defineConfig } from "@playwright/test";

// Scripted play-throughs of the real game in a hidden browser: npm run check:game.
// Screenshots of each checked screen land in e2e/screenshots (not committed).
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.e2e.ts",
  outputDir: "e2e/results",
  timeout: 120_000,
  reporter: "list",
  // One browser at a time: the checks drive the game frame by frame and are
  // quick enough that running them in parallel isn't worth the flakiness.
  workers: 1,
  use: { baseURL: "http://localhost:5173", viewport: { width: 800, height: 450 } },
  webServer: {
    command: "npx vite --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
