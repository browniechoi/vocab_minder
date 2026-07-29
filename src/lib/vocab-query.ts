const MAX_QUERY_LENGTH = 80;
const MAX_QUERY_WORDS = 7;

export type VocabQueryValidation =
  | {
      message: null;
      normalizedQuery: string;
    }
  | {
      message: string;
      normalizedQuery: "";
    };

function normalizeQuery(query: string) {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

export function validateVocabQuery(query: string): VocabQueryValidation {
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      message: "Type a word or short phrase before searching.",
      normalizedQuery: "",
    };
  }

  if (trimmed.length > MAX_QUERY_LENGTH || /[\r\n]/u.test(query)) {
    return {
      message: "Search for one word or a short English phrase.",
      normalizedQuery: "",
    };
  }

  if (
    /(?:https?:\/\/|www\.)/iu.test(trimmed) ||
    /\S+@\S+\.\S+/u.test(trimmed)
  ) {
    return {
      message: "Links and email addresses are not vocabulary terms.",
      normalizedQuery: "",
    };
  }

  const normalizedQuery = normalizeQuery(trimmed);
  const words = normalizedQuery.split(" ").filter(Boolean);
  if (
    !/[a-z]/u.test(normalizedQuery) ||
    words.length === 0 ||
    words.length > MAX_QUERY_WORDS
  ) {
    return {
      message: "Search for one word or a short English phrase.",
      normalizedQuery: "",
    };
  }

  return {
    message: null,
    normalizedQuery,
  };
}
