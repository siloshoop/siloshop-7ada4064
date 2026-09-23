import { defineConfig } from "@playwright/test";
import { loadEnv } from "vite";

const env = loadEnv("", process.cwd(), "");

process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:8080",
    locale: "ar-SY",
    colorScheme: "light",
    reducedMotion: "reduce",
  },
  webServer: {
    command: "bun run dev --host 0.0.0.0 --port 8080",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});