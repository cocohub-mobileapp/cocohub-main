import i18n from '../i18n';

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  ar: 'ar-SA',
};

function locale(): string {
  return LOCALE_MAP[i18n.language] ?? i18n.language;
}

export function formatLocalDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatLocalTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatLocalDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const abs = Math.abs(diffMs);

  if (abs < 60_000) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  if (abs < 2_592_000_000) return rtf.format(Math.round(diffMs / 86_400_000), 'day');
  if (abs < 31_536_000_000) return rtf.format(Math.round(diffMs / 2_592_000_000), 'month');
  return rtf.format(Math.round(diffMs / 31_536_000_000), 'year');
}
