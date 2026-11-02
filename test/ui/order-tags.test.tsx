// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrderTags } from "../../app/components/order-tags";

afterEach(cleanup);

const noop = () => {};

const props = {
  orderName: "#1006",
  tags: ["Snowboard", "VIP"],
  saving: false,
  onAdd: noop,
};

const field = (container: HTMLElement) =>
  container.querySelector("s-text-field")!;

// Polaris's script never runs in the tests, so the field is a plain element and its
// value is what the test sets.
function submit(container: HTMLElement, value: string) {
  Object.assign(field(container), { value });
  fireEvent.submit(container.querySelector("form")!);
}

it("BE-3 Add tag : 1. shows the order's tags, and adds the tag in the field on submit", () => {
  const onAdd = vi.fn();
  const { container } = render(<OrderTags {...props} onAdd={onAdd} />);

  const chips = [...container.querySelectorAll("s-chip")];
  expect(chips.map((chip) => chip.textContent)).toEqual(["Snowboard", "VIP"]);
  expect(field(container).getAttribute("label")).toBe("Add a tag to #1006");
  expect(container.querySelector("s-button")?.textContent).toBe("Add");

  submit(container, "wholesale");

  expect(onAdd).toHaveBeenCalledExactlyOnceWith("wholesale");
});

it("BE-3 Add tag : 1. the add button is disabled while saving", () => {
  const onAdd = vi.fn();
  const { container } = render(<OrderTags {...props} onAdd={onAdd} saving />);

  const button = container.querySelector("s-button");
  expect(button?.hasAttribute("disabled")).toBe(true);
  expect(button?.hasAttribute("loading")).toBe(true);

  // Enter in the field submits the form without going through the button.
  submit(container, "wholesale");
  expect(onAdd).not.toHaveBeenCalled();
});
