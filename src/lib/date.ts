export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  return new Date(year, month - 1, day);
}

export function formatForecastDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatLocalDateTime(dateTimeStr: string, timezone?: string): string {
  return new Date(dateTimeStr).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}
