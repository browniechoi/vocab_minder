const CANONICAL_LABELS = [
  "old-fashioned",
  "disapproving",
  "sometimes offensive",
  "often offensive",
  "somewhat formal",
  "informal",
  "literary",
  "medical",
  "technical",
  "formal",
  "slang",
  "British",
  "American",
  "US",
] as const;

const LABEL_BY_LOWERCASE = new Map(
  CANONICAL_LABELS.map((label) => [label.toLowerCase(), label]),
);

const LABEL_PATTERN = CANONICAL_LABELS.map(escapeRegex).join("|");
const INLINE_LABEL_PATTERN = new RegExp(
  `^((?:(?:${LABEL_PATTERN})(?:\\s*\\+\\s*)?)+)\\s+(.+)$`,
  "i",
);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLabel(value: string) {
  const label = value.replace(/\{[^}]+\}/g, "").replace(/\s+/g, " ").trim();
  if (!label) {
    return null;
  }

  return LABEL_BY_LOWERCASE.get(label.toLowerCase()) ?? label;
}

export function normalizeDefinitionLabels(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  return values.flatMap((value) => {
    if (typeof value !== "string") {
      return [];
    }

    const label = normalizeLabel(value);
    if (!label || seen.has(label)) {
      return [];
    }

    seen.add(label);
    return [label];
  });
}

export function parseDefinitionLabelText(value: string) {
  return normalizeDefinitionLabels(value.split(/\s*\+\s*|,\s*/));
}

export function splitInlineDefinitionLabels(definition: string) {
  const trimmedDefinition = definition.trim();
  const match = INLINE_LABEL_PATTERN.exec(trimmedDefinition);
  if (!match) {
    return {
      definition: trimmedDefinition,
      definitionLabels: [] as string[],
    };
  }

  const matchedPrefix = trimmedDefinition.slice(
    0,
    trimmedDefinition.length - match[2].length,
  );
  const labels = parseDefinitionLabelText(matchedPrefix);

  if (labels.length === 0) {
    return {
      definition: trimmedDefinition,
      definitionLabels: [] as string[],
    };
  }

  return {
    definition: match[2].trim(),
    definitionLabels: labels,
  };
}
