import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { TEST_DATABASE_PATH, TEST_DATABASE_URL } from "./test-database";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../prisma/migrations");

// Recreates the test database from the committed migrations, so a schema change
// without a migration fails the tests instead of passing against a stale database.
export default function setup() {
  rmSync(TEST_DATABASE_PATH, { force: true });
  rmSync(`${TEST_DATABASE_PATH}-journal`, { force: true });

  const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migration of migrations) {
    execFileSync(
      "npx",
      [
        "prisma",
        "db",
        "execute",
        "--url",
        TEST_DATABASE_URL,
        "--file",
        path.join(MIGRATIONS_DIR, migration, "migration.sql"),
      ],
      { stdio: "inherit" },
    );
  }
}
