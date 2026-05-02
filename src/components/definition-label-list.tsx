export function DefinitionLabelList({
  labels,
}: {
  labels?: string[];
}) {
  if (!labels?.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-full border border-[color:var(--color-border)] bg-[rgba(17,32,57,0.04)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-muted)]"
        >
          {label}
        </span>
      ))}
    </div>
  );
}
