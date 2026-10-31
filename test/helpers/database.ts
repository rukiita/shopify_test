import db from "../../app/db.server";
import { TEST_DATABASE_URL } from "../setup/test-database";

// Deletes every row from every application table. Call it in `beforeEach` in any
// test file that reads or writes the database.
export async function resetDatabase() {
  // Guard against wiping the development database if the override is ever lost.
  if (process.env.DATABASE_URL !== TEST_DATABASE_URL) {
    throw new Error(
      `resetDatabase() only runs against ${TEST_DATABASE_URL}, got ${process.env.DATABASE_URL}`,
    );
  }

  const tables = await db.$queryRaw<{ name: string }[]>`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> '_prisma_migrations'
  `;

  for (const { name } of tables) {
    // Table names come from sqlite_master, not from input.
    await db.$executeRawUnsafe(`DELETE FROM "${name}"`);
  }
}
