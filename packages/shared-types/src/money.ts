/**
 * Money is never client-computed (CLAUDE.md Law #3). All amounts are integer minor units
 * (e.g. euro cents) as issued by the server, paired with an explicit currency. The client
 * renders these; it never does price arithmetic.
 *
 * NOTE [KAPAR-BLOCKER §10]: currency display is EUR in the mockups but MKD is legal tender.
 * Which currency checkout must legally show is unresolved — do not hardcode a display currency
 * until the consumer price-display law question is answered.
 */
export interface Money {
  /** Integer amount in the currency's minor unit (cents). Never a float. */
  readonly minor: number;
  /** ISO 4217 code, e.g. "EUR" or "MKD". */
  readonly currency: string;
}
