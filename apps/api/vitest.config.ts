import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/vorbestell_test",
      JWT_SECRET: "test-secret-change-me",
      CRON_ENABLED: "false"
    },
    setupFiles: ["./tests/setup.ts"]
  }
});
