import { expect, it } from "vitest";
import { normalizeTag } from "../../app/lib/domain/normalize-tag";

it("BE-3 Add tag : 1. trims surrounding whitespace", () => {
  expect(normalizeTag("  VIP \n", [])).toEqual({ tag: "VIP" });
});

it("BE-3 Add tag : 1. rejects an empty tag", () => {
  expect(normalizeTag("", [])).toEqual({ error: "Enter a tag" });
  expect(normalizeTag("   ", [])).toEqual({ error: "Enter a tag" });
});

it("BE-3 Add tag : 1. rejects a tag that already exists", () => {
  const error = "This order already has that tag";
  expect(normalizeTag("VIP", ["wholesale", "VIP"])).toEqual({ error });
  // tagsAdd treats these as the same tag, and leaves the existing one as it is.
  expect(normalizeTag("vip", ["VIP"])).toEqual({ error });
  expect(normalizeTag(" VIP ", ["VIP"])).toEqual({ error });
  expect(normalizeTag("VIP", ["wholesale"])).toEqual({ tag: "VIP" });
});
