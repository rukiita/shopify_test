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
  onRemove: noop,
};

const field = (container: HTMLElement) =>
  container.querySelector("s-text-field")!;

const addButton = (container: HTMLElement) =>
  container.querySelector("form s-button");

const removeButtons = (container: HTMLElement) => [
  ...container.querySelectorAll('s-button[icon="x"]'),
];

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
  expect(addButton(container)?.textContent).toBe("Add");

  submit(container, "wholesale");

  expect(onAdd).toHaveBeenCalledExactlyOnceWith("wholesale");
});

it("BE-3 Add tag : 1. the add button is disabled while saving", () => {
  const onAdd = vi.fn();
  const { container } = render(<OrderTags {...props} onAdd={onAdd} saving />);

  const button = addButton(container);
  expect(button?.hasAttribute("disabled")).toBe(true);
  expect(button?.hasAttribute("loading")).toBe(true);

  // Enter in the field submits the form without going through the button.
  submit(container, "wholesale");
  expect(onAdd).not.toHaveBeenCalled();
});

it("BE-3 Add tag : 1. the reason is shown when a tag is rejected", () => {
  const error = "This order already has that tag";
  const { container, rerender } = render(
    <OrderTags {...props} result={{ error }} />,
  );
  expect(field(container).getAttribute("error")).toBe(error);

  // The reason is about the last attempt, so it goes while the next one is saved.
  rerender(<OrderTags {...props} result={{ error }} saving />);
  expect(field(container).hasAttribute("error")).toBe(false);
});

it("BE-3 Add tag : 1. the field is cleared after a tag is added", () => {
  const { container, rerender } = render(<OrderTags {...props} saving />);
  submit(container, "wholesale");
  const typedIn = field(container);

  rerender(<OrderTags {...props} result={{ error: "Rejected" }} />);
  // A rejected tag stays, so that it can be corrected.
  expect(field(container)).toBe(typedIn);

  rerender(<OrderTags {...props} result={{ ok: true }} />);
  expect(field(container)).not.toBe(typedIn);
});

it("BE-4 Remove tag : 1. each tag has a remove button", () => {
  const onRemove = vi.fn();
  const { container } = render(<OrderTags {...props} onRemove={onRemove} />);

  expect(
    removeButtons(container).map((button) =>
      button.getAttribute("accessibilityLabel"),
    ),
  ).toEqual(["Remove tag Snowboard", "Remove tag VIP"]);

  fireEvent.click(removeButtons(container)[1]);

  expect(onRemove).toHaveBeenCalledExactlyOnceWith("VIP");
});

it("BE-4 Remove tag : 1. the remove button is disabled while saving", () => {
  const { container } = render(<OrderTags {...props} saving />);

  const buttons = removeButtons(container);
  expect(buttons).toHaveLength(2);
  for (const button of buttons) {
    expect(button.hasAttribute("disabled")).toBe(true);
  }
});

it("BE-4 Remove tag : 1. removing a tag keeps what was typed in the field", () => {
  const { container, rerender } = render(<OrderTags {...props} />);
  const typedIn = field(container);

  fireEvent.click(removeButtons(container)[0]);
  rerender(<OrderTags {...props} result={{ ok: true }} />);

  expect(field(container)).toBe(typedIn);
});
