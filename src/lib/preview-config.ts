export const LOCAL_STORAGE_KEY = "vocab-v0-local-state";

export function getPreviewStorageKey(scope: string) {
  const normalizedScope = scope.trim() || "guest";

  return `${LOCAL_STORAGE_KEY}:${normalizedScope}`;
}

export function getReviewStorageKey(scope: string) {
  return `${getPreviewStorageKey(scope)}:review`;
}
