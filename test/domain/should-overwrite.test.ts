import { expect, it } from "vitest";
import { shouldOverwrite } from "../../app/lib/domain/should-overwrite";

const STORED = new Date("2026-11-01T03:25:55Z");

it("BE-1 Webhook ingestion : 2. decides to overwrite when updatedAt is newer than stored", () => {
  expect(shouldOverwrite(STORED, new Date("2026-11-01T03:25:56Z"))).toBe(true);
  // Nothing stored yet.
  expect(shouldOverwrite(null, STORED)).toBe(true);
});
