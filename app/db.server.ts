import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

// Matches the URL in prisma/schema.prisma. Relative paths there resolve from the
// schema's directory, so the development database is prisma/dev.sqlite either way.
const SCHEMA_DATABASE_URL = "file:dev.sqlite";

// One connection, so database writes run one at a time (#77, ADR-0005). With
// several connections, an interactive transaction (saveOrder) on one connection
// waits on another's SQLite lock until Prisma's timeouts end it, and concurrent
// order webhooks fail. With one, the queries wait for the connection instead.
function withSingleConnection(url: string) {
  const [path, query] = url.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("connection_limit", "1");
  return `${path}?${params.toString()}`;
}

// `DATABASE_URL` overrides the URL in prisma/schema.prisma. Tests use it to point
// at their own database (vitest.config.ts); development leaves it unset.
const createClient = () =>
  new PrismaClient({
    datasourceUrl: withSingleConnection(
      process.env.DATABASE_URL ?? SCHEMA_DATABASE_URL,
    ),
  });

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createClient();
  }
}

const prisma = global.prismaGlobal ?? createClient();

export default prisma;
