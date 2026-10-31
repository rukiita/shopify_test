import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { TEST_DATABASE_URL } from "./test/setup/test-database";

// Kept separate from vite.config.ts: the React Router plugin builds the app
// and is not needed when running tests.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "node",
    globalSetup: ["./test/setup/global-setup.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SHOPIFY_TESTING: "1",
    },
    // Every test file shares one SQLite file, so files run one at a time.
    fileParallelism: false,
  },
});
