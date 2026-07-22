const DEFAULT_RANGE_DAYS = 30;

/** Shared by every Reports/Advanced Analytics endpoint that accepts `?from=&to=`. */
export function resolveRange(from?: string, to?: string): { start: Date; end: Date } {
  const end = to ? new Date(to) : new Date();
  const start = from
    ? new Date(from)
    : new Date(end.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  return { start, end };
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
