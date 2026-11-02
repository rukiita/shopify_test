import { useEffect, useRef, useState, type FormEvent } from "react";
import type { TagResult } from "../lib/tag-order.server";

interface OrderTagsProps {
  orderName: string;
  tags: string[];
  saving: boolean;
  // How the last attempt ended, once one has finished.
  result?: TagResult;
  onAdd: (tag: string) => void;
}

// One order's tags in the order list (#3). Presentational: the page owns the request.
export function OrderTags({
  orderName,
  tags,
  saving,
  result,
  onAdd,
}: OrderTagsProps) {
  const field = useRef<HTMLElementTagNameMap["s-text-field"]>(null);

  // Cleared by replacing the element: Polaris can drop a property set from an effect
  // on a hydrated element (#2).
  const [fieldKey, setFieldKey] = useState(0);
  const [lastResult, setLastResult] = useState(result);
  if (result !== lastResult) {
    setLastResult(result);
    if (result && "ok" in result) {
      setFieldKey(fieldKey + 1);
    }
  }

  // The new element takes the focus, so that the next tag can be typed straight away.
  useEffect(() => {
    if (fieldKey > 0) {
      field.current?.focus();
    }
  }, [fieldKey]);

  const error = !saving && result && "error" in result ? result.error : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!saving) {
      onAdd(field.current!.value);
    }
  };

  return (
    <s-stack direction="block" gap="small-200">
      {tags.length > 0 && (
        <s-stack direction="inline" gap="small-200">
          {tags.map((tag) => (
            <s-chip key={tag}>{tag}</s-chip>
          ))}
        </s-stack>
      )}
      <form onSubmit={submit}>
        <s-grid
          gridTemplateColumns="1fr auto"
          gap="small-200"
          alignItems="start"
        >
          <s-text-field
            key={fieldKey}
            ref={field}
            label={`Add a tag to ${orderName}`}
            labelAccessibilityVisibility="exclusive"
            name="tag"
            {...(error ? { error } : {})}
            {...(saving ? { readOnly: true } : {})}
          />
          {/* React 18 writes `disabled={false}` as the attribute disabled="false",
              which still disables the button, so the attributes are only added
              while saving. */}
          <s-button
            type="submit"
            {...(saving ? { disabled: true, loading: true } : {})}
          >
            Add
          </s-button>
        </s-grid>
      </form>
    </s-stack>
  );
}
