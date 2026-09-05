// Converts a snake_case status enum (e.g. "package_delivered") into a
// human-readable label ("Package Delivered") for display purposes only —
// callers still use the raw value for className/logic matching.
export function formatStatusLabel(value) {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
