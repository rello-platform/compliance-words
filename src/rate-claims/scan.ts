/**
 * `scanRateClaims(text)` — numeric/comparison-aware Reg-Z + UDAAP rate-claim
 * checker (DRAFT — warn-only, off by default).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * STATUS: DRAFT for Kelly's review. Both rules default to WARNING severity (NOT
 * HARD_BLOCK) and `RATE_CLAIM_CONFIG.armed` is `false`. No M7 / lane / Milo gate
 * promotes these to a blocking severity until Kelly approves arming. The scanner
 * never raises severity on its own; a caller may pass `severityFloor` to RAISE
 * the reported severity ONLY after Kelly approves arming.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * WHY A SEPARATE SCANNER (not LANE_REGISTRY rows). The two rules below are
 * NUMERIC- and COMPARISON-aware: a stated mortgage-rate FIGURE ("5.5%", "the
 * 30-year fixed is sitting around 5.5%") and a basis-point comparison ("40 bps
 * below market"). The shared phrase matcher in `../match-engine.ts` matches an
 * ORDERED WORD SEQUENCE separated only by non-word chars — it CANNOT span a
 * number, because digits are word chars (this exact limitation is documented on
 * the `apr trigger term` LANE_REGISTRY row, which says a consumer "MUST pair this
 * with its own Reg-Z numeric scan"). This module IS that numeric scan. It reuses
 * the same `maskHtml` offset-preserving primitive as the shared engine and the
 * same `{ token, message, severity }` finding shape as `scanLaneViolations`, so a
 * consumer wires it identically. The Python port (`python/rate_claims.py`) mirrors
 * the same algorithm; `python/rate_claims_parity_corpus.json` re-asserts parity.
 *
 * SCOPE — what each rule catches, verbatim for Kelly's line-by-line review.
 *
 * ── REG-Z rule (`regz_rate_figure_no_apr`) ──────────────────────────────────
 * Reg Z / TILA (12 CFR §1026.24) — a stated consumer-credit RATE figure is a
 * "trigger term" that pulls in mandatory APR disclosure. The rule flags a
 * percentage that reads as an interest / mortgage RATE when no "APR" token sits
 * nearby. It mirrors Milo's eval helper `detectsRateFigure` byte-for-byte: a
 * percentage flags ONLY in a rate context (a rate cue near the %), and is
 * EXCLUDED when it reads as a home-VALUE / price / appreciation figure (a value
 * cue near the % AND no rate cue). The APR-present escape (an "APR" / "A.P.R."
 * token within proximity of the % → not flagged) is the additive Reg-Z piece on
 * top of `detectsRateFigure`: a properly-disclosed "6.1% APR" is compliant.
 *
 *   FLAGS:   "the 30-year fixed is sitting around 5.5% right now"
 *            "I'm offering 6.1% on a 30-year fixed"
 *            "a rate of 6.125%"
 *            "rates near 6%"
 *            a bare "6.125%" with no value context (conservative — a stray rate
 *            number must still trip the ban)
 *   ALLOWS:  "6.1% APR on a 30-year fixed" (APR disclosed)
 *            "prices are up 5% from last year" (home-value figure)
 *            "home values rose roughly 5% year over year"
 *            "rates have eased lately" (DIRECTIONAL — no figure)
 *
 * ── UDAAP rule (`udaap_rate_comparison`) ────────────────────────────────────
 * CFPB UDAAP — an unsubstantiated rate self-comparison ("below market", "lower
 * than other lenders", "beat any rate", "lowest rate") is a deceptive/unfair
 * claim. The rule flags rate-COMPARISON collocations only; a factual market or
 * home-value stat sourced from data is fine.
 *
 *   FLAGS:   "running below the broader market average"
 *            "below market", "below the market average"
 *            "lower than other lenders", "better than the banks"
 *            "40 bps below", "40 basis points below"
 *            "beat any rate", "we'll beat any rate", "lowest rate", "best rate"
 *            "unbeatable rate", "rates nobody can match"
 *   ALLOWS:  "home values are up 5% from last year" (market/value stat)
 *            "the median sale price in your zip is $X" (data stat)
 *            "rates have eased lately" (directional, no comparison)
 *
 * Pure function over text; no I/O, no throw on bad input.
 */

import { maskHtml } from "../match-engine.js";

/** Severity of a rate-claim finding. Mirrors the lane checker's three tiers. */
export type RateClaimSeverity = "HARD_BLOCK" | "WARNING" | "REVIEW_FLAG";

/** Which rule produced the finding. */
export type RateClaimToken = "regz_rate_figure_no_apr" | "udaap_rate_comparison";

export interface RateClaimOptions {
  /** Raise the reported severity to at least this floor (pass "HARD_BLOCK" ONLY
   *  after Kelly approves arming). Default: each rule reports its own draft
   *  WARNING. The floor can only RAISE, never lower. */
  readonly severityFloor?: RateClaimSeverity;
  /** Char ranges the caller marked as an illustrative/disclaimer block. A match
   *  inside one of these is allowed (fail-safe-strict: an unmarked block still
   *  flags). Mirrors the lane checker's `disclaimerRanges`. */
  readonly disclaimerRanges?: ReadonlyArray<readonly [number, number]>;
}

export interface RateClaimViolation {
  readonly token: RateClaimToken;
  /** Effective severity after applying `severityFloor` (draft default: WARNING). */
  readonly severity: RateClaimSeverity;
  /** Char offset of the match in the ORIGINAL input text. */
  readonly index: number;
  readonly matchedText: string;
  /** Compliant in-lane substitution suggested in the finding message. */
  readonly suggest: string;
  /** Actionable, parameterized message (mirrors the lane Violation message form). */
  readonly message: string;
}

/** DRAFT posture metadata — surfaced so a consumer can assert "not armed". */
export const RATE_CLAIM_CONFIG = {
  status: "DRAFT",
  defaultSeverity: "WARNING" as RateClaimSeverity,
  armed: false,
  tokens: ["regz_rate_figure_no_apr", "udaap_rate_comparison"] as const,
} as const;

/** Default draft severity for every rate-claim rule (warn-only). */
const DEFAULT_SEVERITY: RateClaimSeverity = "WARNING";

const SEVERITY_RANK: Record<RateClaimSeverity, number> = {
  REVIEW_FLAG: 0,
  WARNING: 1,
  HARD_BLOCK: 2,
};

function applyFloor(rowSeverity: RateClaimSeverity, floor: RateClaimSeverity | undefined): RateClaimSeverity {
  if (!floor) return rowSeverity;
  return SEVERITY_RANK[floor] > SEVERITY_RANK[rowSeverity] ? floor : rowSeverity;
}

function withinAnyRange(
  offset: number,
  ranges: ReadonlyArray<readonly [number, number]> | undefined,
): boolean {
  if (!ranges) return false;
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

// ── REG-Z numeric primitives (mirror Milo's detectsRateFigure exactly) ───────
//
// A percentage-shaped token: "6", "6.1", "6.125" followed by % or "percent".
// Verbatim from composition-prompt-eval.test.ts::detectsRateFigure so the
// platform has ONE rate-vs-value distinction, not two that can drift.
const PERCENT_TOKEN = /\b\d{1,2}(?:\.\d{1,3})?\s*(?:%|percent\b)/gi;

// Window (chars) scanned on each side of a percentage for context cues.
const WINDOW = 40;

// Rate-context cues — a % near any of these reads as an interest/mortgage RATE.
// Verbatim from detectsRateFigure RATE_CUES.
const RATE_CUES =
  /\brate\b|\brates\b|\bmortgage\b|\bapr\b|\bloan\b|\b30[\s-]?(?:year|yr)\b|\b15[\s-]?(?:year|yr)\b|thirty[\s-]?year|fifteen[\s-]?year|\bfixed\b|\barm\b|\bapy\b|\binterest\b|\bpoints?\b|\bbps\b|basis points?|offering|offered|locked? in|lock(?:ed)? at/i;

// Value-context cues — a % near any of these reads as a home-value / price /
// appreciation figure (allowed). Verbatim from detectsRateFigure VALUE_CUES.
// "market" alone is intentionally NOT a value cue: "below the market" pairs with
// rate talk and must not whitelist.
const VALUE_CUES =
  /\bup\b|from last year|year[\s-]?over[\s-]?year|\byoy\b|\bprices?\b|home values?|\bvalues?\b|\bworth\b|appreciat|\bgained\b|\bgaining\b|\brose\b|\brisen\b|\brising\b|climbed|\bequity\b|\bappreciation\b/i;

// APR-present escape — an "APR"/"A.P.R." token near the % means the rate figure
// is properly Reg-Z-disclosed. This is the additive Reg-Z piece on top of
// detectsRateFigure (which only decides rate-vs-value, not APR-presence).
const APR_PRESENT = /\bapr\b|\ba\.p\.r\.|\bannual percentage rate\b/i;

function scanRegZ(text: string, masked: string): Array<{ index: number; matchedText: string }> {
  const lower = masked.toLowerCase();
  const out: Array<{ index: number; matchedText: string }> = [];

  PERCENT_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PERCENT_TOKEN.exec(lower)) !== null) {
    const idx = m.index;
    if (PERCENT_TOKEN.lastIndex === idx) PERCENT_TOKEN.lastIndex++; // zero-width guard

    const start = Math.max(0, idx - WINDOW);
    const end = Math.min(lower.length, idx + m[0].length + WINDOW);
    const ctx = lower.slice(start, end);

    const hasRateCue = RATE_CUES.test(ctx);
    const hasValueCue = VALUE_CUES.test(ctx);

    // Allow a clean home-VALUE figure: value cue present AND no rate cue.
    if (hasValueCue && !hasRateCue) continue;

    // Allow a properly Reg-Z-disclosed rate: an APR token sits near the %.
    if (APR_PRESENT.test(ctx)) continue;

    // Everything else flags: explicit rate context with no APR, OR an ambiguous
    // % with neither cue (conservative — a stray rate number must still trip).
    out.push({ index: idx, matchedText: text.slice(idx, idx + m[0].length) });
  }
  return out;
}

// ── UDAAP rate-comparison primitives ─────────────────────────────────────────
//
// Unsubstantiated rate SELF-comparison collocations. Conservative-against-false-
// positives: only RATE comparisons are flagged — a factual market/value stat
// ("home values up 5%", "median price $X") carries no rate-comparison framing
// and is not matched. Each alternative is a fixed collocation; the basis-point
// form is the one place a number may appear, handled by an explicit
// `\d+\s*(?:bps|basis points?)\s+(?:below|under|lower)` sub-pattern.
//
// FULL PLAIN-LANGUAGE PATTERN LIST (for Kelly's line-by-line approval):
//   below market | below the market | below the (broader) market average |
//   below the market rate | below the going rate | below the national average |
//   below average (rate) | lower than (the|other) lenders|banks |
//   lower than the competition | better than (the|other) lenders|banks |
//   beat any rate | beat your current rate | beat the bank | we'll beat |
//   nobody can beat | can't be beat | unbeatable rate(s) |
//   lowest rate(s) (around|anywhere|in town|guaranteed) | the lowest rate |
//   best rate(s) (around|anywhere|in town|guaranteed) | the best rate |
//   most competitive rate | rate(s) nobody can match | N bps below |
//   N basis points below | N points below (the) market
const UDAAP_PATTERNS: ReadonlyArray<{ re: RegExp; label: string }> = [
  // "below market" family (the live-violation pattern: "running below the
  // broader market average"). Optional "the"/"broader"/"national"/"going".
  {
    re: /\bbelow\s+(?:the\s+)?(?:broader\s+|national\s+|going\s+)?market(?:\s+(?:average|rate))?\b/i,
    label: "below-market rate comparison",
  },
  { re: /\bbelow\s+(?:the\s+)?national\s+average\b/i, label: "below-national-average rate comparison" },
  { re: /\bbelow\s+average\s+(?:rate|rates|on\s+(?:your|the)\s+(?:rate|loan|mortgage))?\b/i, label: "below-average rate comparison" },
  // "lower / better than other lenders/banks/competition"
  { re: /\b(?:lower|better)\s+than\s+(?:the\s+|other\s+|your\s+(?:current\s+)?)?(?:lenders?|banks?|competition|competitors?|rate)\b/i, label: "lower-than-competitors rate comparison" },
  // "beat any/your rate", "beat the bank", "we'll beat", "nobody can beat", "can't be beat"
  { re: /\bbeat\s+(?:any|your|the|their|our\s+competitors?'?)\s+(?:rate|rates|price|bank|lender|offer)\b/i, label: "beat-any-rate claim" },
  { re: /\b(?:we'?ll|we\s+will|i'?ll|i\s+will)\s+beat\b/i, label: "we'll-beat claim" },
  { re: /\b(?:nobody|no\s+one)\s+can\s+beat\b/i, label: "nobody-can-beat claim" },
  { re: /\bcan'?t\s+be\s+beat(?:en)?\b/i, label: "can't-be-beat claim" },
  { re: /\bunbeatable\s+rates?\b/i, label: "unbeatable-rate claim" },
  // "lowest / best / most competitive rate"
  { re: /\b(?:the\s+)?lowest\s+rates?\b/i, label: "lowest-rate superlative claim" },
  { re: /\b(?:the\s+)?best\s+rates?\b/i, label: "best-rate superlative claim" },
  { re: /\bmost\s+competitive\s+rates?\b/i, label: "most-competitive-rate claim" },
  { re: /\brates?\s+(?:that\s+)?(?:nobody|no\s+one)\s+can\s+match\b/i, label: "no-one-can-match-rate claim" },
  // Basis-point / point comparison (the one numeric UDAAP form).
  { re: /\b\d+(?:\.\d+)?\s*(?:bps|basis\s+points?|points?)\s+(?:below|under|lower\s+than|cheaper\s+than)\b/i, label: "basis-points-below rate comparison" },
];

function scanUdaap(text: string, masked: string): Array<{ index: number; matchedText: string }> {
  const out: Array<{ index: number; matchedText: string }> = [];
  const seen = new Set<number>();
  for (const { re } of UDAAP_PATTERNS) {
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    r.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = r.exec(masked)) !== null) {
      if (r.lastIndex === m.index) r.lastIndex++; // zero-width guard
      if (seen.has(m.index)) continue; // de-dupe overlapping patterns at same offset
      seen.add(m.index);
      out.push({ index: m.index, matchedText: text.slice(m.index, m.index + m[0].length) });
    }
  }
  return out;
}

const REGZ_SUGGEST =
  "omit the rate figure (or pair it with APR) and use directional language ('rates have eased') — rate quotes come from the loan officer";
const UDAAP_SUGGEST =
  "remove the rate self-comparison; cite only factual, data-sourced market/value stats";

function buildMessage(token: RateClaimToken, matchedText: string, index: number, severity: RateClaimSeverity, suggest: string): string {
  const label =
    token === "regz_rate_figure_no_apr"
      ? "a stated mortgage-rate figure without a nearby APR (Reg Z / TILA §1026.24)"
      : "an unsubstantiated rate self-comparison (CFPB UDAAP)";
  return `⚠ ${severity} [rate-claim]: "${matchedText}" is ${label} ("${token}") at offset ${index} → ${suggest}`;
}

/**
 * Scan `text` for Reg-Z rate-figure and UDAAP rate-comparison violations.
 * Empty/non-string input returns `[]` (no throw). Matches inside a caller-marked
 * `disclaimerRanges` block are excused (fail-safe-strict otherwise).
 */
export function scanRateClaims(
  text: string,
  opts: RateClaimOptions = {},
): readonly RateClaimViolation[] {
  if (typeof text !== "string" || text.length === 0) return [];

  const masked = maskHtml(text);
  const violations: RateClaimViolation[] = [];

  const push = (token: RateClaimToken, index: number, matchedText: string, suggest: string) => {
    if (withinAnyRange(index, opts.disclaimerRanges)) return;
    const severity = applyFloor(DEFAULT_SEVERITY, opts.severityFloor);
    violations.push({
      token,
      severity,
      index,
      matchedText,
      suggest,
      message: buildMessage(token, matchedText, index, severity, suggest),
    });
  };

  for (const { index, matchedText } of scanRegZ(text, masked)) {
    push("regz_rate_figure_no_apr", index, matchedText, REGZ_SUGGEST);
  }
  for (const { index, matchedText } of scanUdaap(text, masked)) {
    push("udaap_rate_comparison", index, matchedText, UDAAP_SUGGEST);
  }

  violations.sort((a, b) => a.index - b.index || a.token.localeCompare(b.token));
  return violations;
}

/**
 * True iff `text` contains at least one Reg-Z / UDAAP rate-claim violation.
 * Draft posture: reports PRESENCE of a (warn-level) issue — does NOT block by
 * itself; the consumer decides.
 */
export function hasRateClaimViolation(text: string, opts: RateClaimOptions = {}): boolean {
  return scanRateClaims(text, opts).length > 0;
}
