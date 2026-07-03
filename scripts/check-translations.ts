#!/usr/bin/env ts-node
/**
 * CI script: fails with exit code 1 if any supported locale is missing
 * translation keys that exist in the base (en) locale.
 *
 * Usage:
 *   npx ts-node scripts/check-translations.ts
 *
 * Add to CI:
 *   - run: npx ts-node scripts/check-translations.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const BASE_LOCALE = 'en';
const SUPPORTED = ['en', 'es', 'fr'];

type NestedRecord = { [key: string]: string | NestedRecord };

function flattenKeys(obj: NestedRecord, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      keys.push(...flattenKeys(v as NestedRecord, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function loadLocale(locale: string): NestedRecord {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing locale file: ${filePath}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as NestedRecord;
}

let hasErrors = false;

const baseKeys = flattenKeys(loadLocale(BASE_LOCALE));

for (const locale of SUPPORTED) {
  if (locale === BASE_LOCALE) continue;

  const localeKeys = new Set(flattenKeys(loadLocale(locale)));
  const missing = baseKeys.filter((k) => !localeKeys.has(k));

  if (missing.length > 0) {
    console.error(`\n[${locale}] Missing ${missing.length} translation key(s):`);
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
    hasErrors = true;
  } else {
    console.log(`[${locale}] ✓ All ${baseKeys.length} keys present`);
  }
}

if (hasErrors) {
  console.error('\nTranslation check FAILED. Add missing keys before merging.');
  process.exit(1);
} else {
  console.log('\nTranslation check passed.');
}
