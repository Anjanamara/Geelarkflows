/**
 * D1 CURRENT_TIMESTAMP values are UTC but arrive as `YYYY-MM-DD HH:mm:ss`
 * without an explicit timezone. Browsers otherwise interpret that shape as
 * local time, shifting every operational timestamp by the administrator's
 * UTC offset. ISO strings that already include a timezone are preserved.
 */
export function toAdminDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const numericDate = new Date(value);
    return Number.isNaN(numericDate.getTime()) ? null : numericDate;
  }

  const raw = String(value || '').trim();
  if (!raw) return null;
  const d1UtcPattern = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
  const normalized = d1UtcPattern.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAdminDateTime(value, fallback = '—') {
  return toAdminDate(value)?.toLocaleString() || fallback;
}

export function formatAdminDate(value, fallback = '—') {
  return toAdminDate(value)?.toLocaleDateString() || fallback;
}

export function formatAdminTime(value, fallback = '—') {
  return toAdminDate(value)?.toLocaleTimeString() || fallback;
}
