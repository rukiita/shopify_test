import { expect, it } from "vitest";
import { shouldOverwrite } from "../../app/lib/domain/should-overwrite";

const STORED = new Date("2026-11-01T03:25:55Z");

it("BE-1 Webhook ingestion : 2. decides to overwrite when updatedAt is equal to or newer than stored", () => {
  expect(shouldOverwrite(STORED, new Date("2026-11-01T03:25:56Z"))).toBe(true);
  // updatedAt has one-second precision, so two changes in the same second share
  // it. The later fetch must still be written.
  expect(shouldOverwrite(STORED, new Date("2026-11-01T03:25:55Z"))).toBe(true);
  // Nothing stored yet.
  expect(shouldOverwrite(null, STORED)).toBe(true);
});

it("BE-1 Webhook ingestion : 2. decides not to overwrite when updatedAt is older", () => {
  expect(shouldOverwrite(STORED, new Date("2026-11-01T03:25:54Z"))).toBe(false);
});
