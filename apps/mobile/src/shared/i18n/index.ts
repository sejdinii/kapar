import { Locale } from '@kapar/shared-types';
import en from './en.json';
import mk from './mk.json';
import sq from './sq.json';

/**
 * i18n catalogs — MK / SQ / EN from day one (SPEC §4). Language applies instantly app-wide and
 * persists server-side (C13c Settings). A full i18n runtime (interpolation, pluralization, locale
 * detection) is wired when M2 localization lands; this establishes the catalog shape and keys.
 *
 * `en` is the reference catalog — every other locale must define the same keys.
 */
export type TranslationKey = keyof typeof en;

export const catalogs: Record<Locale, Record<TranslationKey, string>> = {
  [Locale.English]: en,
  [Locale.Macedonian]: mk,
  [Locale.Albanian]: sq,
};

export const defaultLocale: Locale = Locale.English;
