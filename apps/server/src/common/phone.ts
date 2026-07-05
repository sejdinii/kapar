/**
 * Phone normalization — SPEC A0 (welcome gate) + SPEC B10 (diaspora / cross-border numbers).
 *
 * Kapar's market is North Macedonia, but customers and couples routinely carry foreign numbers
 * (+383 Kosovo, +355 Albania, +41/+49 diaspora, …). We therefore accept ANY country code and
 * only special-case the bare national forms that NM users habitually type (07x… / 7x…).
 *
 * Output is E.164 (`+<digits>`). No external libphonenumber dependency in M1 — the registry is
 * blocked and full metadata validation is not needed for an OTP gate; the SMS provider is the
 * final arbiter of deliverability.
 */

/** E.164 allows at most 15 digits total (country code included). */
const E164_MAX_DIGITS = 15;
/** Floor for a plausible internationally-dialable number (shortest real numbers are ~8 digits). */
const E164_MIN_DIGITS = 8;
/** Default country code for bare national input (North Macedonia). */
const NM_COUNTRY_CODE = '389';

/** Characters users legitimately type while formatting: spaces, dashes, parentheses. */
const FORMATTING_CHARS = /[\s\-()]/g;

/** `+<country><subscriber>` — international with explicit prefix. */
const INTERNATIONAL_PLUS = /^\+(\d+)$/;
/** `00<country><subscriber>` — the old-school international dial prefix. */
const INTERNATIONAL_DOUBLE_ZERO = /^00(\d+)$/;
/** `07x…` — NM national mobile with trunk zero. */
const NM_NATIONAL_WITH_TRUNK = /^0(7\d+)$/;
/** `7x…` — NM national mobile without trunk zero. */
const NM_NATIONAL_BARE = /^(7\d+)$/;

/**
 * Normalize free-form phone input to E.164.
 * Returns `null` when the input cannot be interpreted as a dialable number.
 */
export function normalizeToE164(input: string): string | null {
  const cleaned = input.replace(FORMATTING_CHARS, '');
  if (cleaned.length === 0) {
    return null;
  }

  let digits: string | null = null;

  const plusMatch = INTERNATIONAL_PLUS.exec(cleaned);
  const doubleZeroMatch = plusMatch === null ? INTERNATIONAL_DOUBLE_ZERO.exec(cleaned) : null;
  if (plusMatch?.[1] !== undefined) {
    digits = plusMatch[1];
  } else if (doubleZeroMatch?.[1] !== undefined) {
    digits = doubleZeroMatch[1];
  } else {
    // Bare national input: only the unambiguous NM mobile shapes default to +389.
    // Anything else without a country code is rejected rather than guessed.
    const trunkMatch = NM_NATIONAL_WITH_TRUNK.exec(cleaned);
    const bareMatch = trunkMatch === null ? NM_NATIONAL_BARE.exec(cleaned) : null;
    if (trunkMatch?.[1] !== undefined) {
      digits = NM_COUNTRY_CODE + trunkMatch[1];
    } else if (bareMatch?.[1] !== undefined) {
      digits = NM_COUNTRY_CODE + bareMatch[1];
    }
  }

  if (digits === null) {
    return null;
  }
  // No country code starts with 0 (ITU E.164), and the assembled number must be a plausible length.
  if (digits.startsWith('0')) {
    return null;
  }
  if (digits.length < E164_MIN_DIGITS || digits.length > E164_MAX_DIGITS) {
    return null;
  }
  return `+${digits}`;
}

/** How much of the number stays visible when masking (prefix keeps `+` + country-ish part). */
const MASK_VISIBLE_PREFIX = 5;
const MASK_VISIBLE_SUFFIX = 2;
const MASK_FILLER = '***';

/**
 * Mask a phone number for logs and error messages — full numbers are PII and must never be
 * logged (CLAUDE.md §4: PII excluded from logs). `+38970123456` → `+3897***56`.
 */
export function maskPhone(phone: string): string {
  if (phone.length <= MASK_VISIBLE_PREFIX + MASK_VISIBLE_SUFFIX) {
    return MASK_FILLER;
  }
  return `${phone.slice(0, MASK_VISIBLE_PREFIX)}${MASK_FILLER}${phone.slice(-MASK_VISIBLE_SUFFIX)}`;
}
