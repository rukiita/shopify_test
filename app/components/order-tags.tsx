import { useRef, type FormEvent } from "react";

interface OrderTagsProps {
  orderName: string;
  tags: string[];
  saving: boolean;
  onAdd: (tag: string) => void;
}

// One order's tags in the order list (#3). Presentational: the page owns the request.
export function OrderTags({ orderName, tags, saving, onAdd }: OrderTagsProps) {
  const field = useRef<HTMLElementTagNameMap["s-text-field"]>(null);

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
        <s-grid gridTemplateColumns="1fr auto" gap="small-200" alignItems="start">
          <s-text-field
            ref={field}
            label={`Add a tag to ${orderName}`}
            labelAccessibilityVisibility="exclusive"
            name="tag"
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
