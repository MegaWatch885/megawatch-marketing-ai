export const CONTENT_STATUSES = [
  "uploaded",
  "processing",
  "ready",
  "scheduled",
  "published",
] as const;

export type ContentStatus =
  typeof CONTENT_STATUSES[number];