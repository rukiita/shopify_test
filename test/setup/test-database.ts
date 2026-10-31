import path from "node:path";

export const TEST_DATABASE_PATH = path.resolve(
  import.meta.dirname,
  "../../prisma/test.sqlite",
);
export const TEST_DATABASE_URL = `file:${TEST_DATABASE_PATH}`;
