import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

// `DATABASE_URL` overrides the URL in prisma/schema.prisma. Tests use it to point
// at their own database (vitest.config.ts); development leaves it unset.
const createClient = () =>
  new PrismaClient(
    process.env.DATABASE_URL
      ? { datasourceUrl: process.env.DATABASE_URL }
      : undefined,
  );

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createClient();
  }
}

const prisma = global.prismaGlobal ?? createClient();

export default prisma;
