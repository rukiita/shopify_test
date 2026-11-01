import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient;
}

// One connection, so database writes run one at a time (#77, ADR-0005). With
// several connections, an interactive transaction (saveOrder) on one connection
// waits on another's SQLite lock until Prisma's timeouts end it, and concurrent
// order webhooks fail. With one, the queries wait for the connection instead.
// The URL in prisma/schema.prisma already has the parameter; this adds it to a
// `DATABASE_URL` override. Other parameters are kept as written.
export function withSingleConnection(url: string) {
  const [base, query = ""] = url.split("?", 2);
  const params = query
    .split("&")
    .filter((param) => param !== "" && !param.startsWith("connection_limit="));
  return `${base}?${[...params, "connection_limit=1"].join("&")}`;
}

// `DATABASE_URL` overrides the URL in prisma/schema.prisma. Tests use it to point
// at their own database (vitest.config.ts); development leaves it unset (or empty).
const createClient = () =>
  new PrismaClient(
    process.env.DATABASE_URL
      ? { datasourceUrl: withSingleConnection(process.env.DATABASE_URL) }
      : undefined,
  );

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = createClient();
  }
}

const prisma = global.prismaGlobal ?? createClient();

export default prisma;
