import i18n from '../i18n';

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  ar: 'ar-SA',
};

const IMPERIAL_LOCALES = new Set(['en-US', 'en-LR', 'en-MM']);

function locale(): string {
  return LOCALE_MAP[i18n.language] ?? i18n.language;
}

function isImperial(): boolean {
  return IMPERIAL_LOCALES.has(locale());
}

function kgToLb(kg: number): number {
  return kg * 2.20462;
}

export function formatWeight(kg: number): string {
  if (isImperial()) {
    return `${kgToLb(kg).toFixed(1)} lb`;
  }
  return `${kg.toFixed(1)} kg`;
}

export function parseWeightToKg(value: number): number {
  return isImperial() ? value / 2.20462 : value;
}

export function weightUnit(): string {
  return isImperial() ? 'lb' : 'kg';
}

function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function formatTemperature(celsius: number): string {
  if (isImperial()) {
    return `${celsiusToFahrenheit(celsius).toFixed(1)} °F`;
  }
  return `${celsius.toFixed(1)} °C`;
}

export function temperatureUnit(): string {
  return isImperial() ? '°F' : '°C';
}

const CURRENCY_MAP: Record<string, string> = {
  'en-US': 'USD',
  'es-ES': 'EUR',
  'fr-FR': 'EUR',
  'ar-SA': 'SAR',
};

export function formatCurrency(amount: number, currencyOverride?: string): string {
  const currency = currencyOverride ?? CURRENCY_MAP[locale()] ?? 'USD';
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export interface AddressFields {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export function formatAddress(addr: AddressFields): string {
  if (!addr) return '';
  const parts = isImperial()
    ? [addr.street, addr.city, addr.state, addr.postalCode, addr.country]
    : [addr.street, addr.postalCode, addr.city, addr.state, addr.country];
  return parts.filter(Boolean).join(', ');
}
