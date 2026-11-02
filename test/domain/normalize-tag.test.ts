import { expect, it } from "vitest";
import { normalizeTag } from "../../app/lib/domain/normalize-tag";

it("BE-3 Add tag : 1. trims surrounding whitespace", () => {
  expect(normalizeTag("  VIP \n", [])).toEqual({ tag: "VIP" });
});
