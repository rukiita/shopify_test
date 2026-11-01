import { expect, it } from "vitest";
import { withSingleConnection } from "../../app/db.server";

// One SQLite connection, so concurrent writes wait for each other instead of
// failing on the database lock (#77).

it("BE-7 Whole app : 3. the database URL gets connection_limit=1", () => {
  expect(withSingleConnection("file:/tmp/test.sqlite")).toBe(
    "file:/tmp/test.sqlite?connection_limit=1",
  );
});

it("BE-7 Whole app : 3. the database URL keeps its other parameters as written", () => {
  expect(
    withSingleConnection("file:/tmp/my%20db.sqlite?socket_timeout=10&a=b%2Fc"),
  ).toBe(
    "file:/tmp/my%20db.sqlite?socket_timeout=10&a=b%2Fc&connection_limit=1",
  );
});

it("BE-7 Whole app : 3. the database URL replaces an explicit connection_limit", () => {
  expect(
    withSingleConnection(
      "file:/tmp/test.sqlite?connection_limit=5&socket_timeout=10",
    ),
  ).toBe("file:/tmp/test.sqlite?socket_timeout=10&connection_limit=1");
});
