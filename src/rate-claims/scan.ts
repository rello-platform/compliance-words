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
 * percentage that IS a rate figure when no "APR" token sits nearby. Which
 * percentages are rate figures is K-13 (Kelly's ruling, Rello #1327, applied
 * here 2026-09-16 as K-30; widened 2026-09-24 as A7): a RATE NOUN (rate /
 * rates / APR / fixed / N-year) governs the figure in the same clause, either
 * before it across up to four connective words ("rates are around 6.25%") or
 * after it with at most one preposition or verb between, or the figure carries
 * three decimals. Nothing else is a rate figure
 * — not a bare "6.12%", not a percent behind a preposition, not a percent with
 * a rate word elsewhere in the sentence. The pre-K-13 cue window (a rate cue
 * within 40 characters, minus value cues) is retired: it read "values up 2.4%
 * year over year … rates" as a rate. The APR-present escape (an "APR" /
 * "A.P.R." token within proximity of the % → not flagged) is the additive Reg-Z
 * piece: a properly-disclosed "6.1% APR" is compliant.
 *
 * LEAD-OWNED-RATE escape (Kelly ruling 2026-06-03). A factual statement about the
 * LEAD'S OWN EXISTING rate ("your current rate is 2.88%", "you're sitting on a
 * 2.94% rate", "your 6.5% rate alert") is NOT an advertised offer and does not
 * pull in the §1026.24 trigger-term obligation — no credit is being offered. A %
 * in a lead-OWNED-rate context (`OWN_RATE_CUES`) is allowed, mirroring the
 * home-VALUE escape — UNLESS a PROSPECTIVE-OFFER cue (`OFFER_CUES`: "new rate",
 * "could be/get", "you could", "refi", "lock you in", …) also sits near the %, in
 * which case it is an advertised offer ("your new rate could be 5.5%", "your rate
 * will be 5.5%") and STILL flags. ONLY a MARKET / advertised-OFFER rate without
 * APR is the real violation.
 *
 *   FLAGS:   "a rate of 6.125%" / "rates near 6%" / "rates at 6.4% right now"
 *            "a fixed 7 % loan" / "15-year at 6.25%" / "the 30-year fixed is 5.5%"
 *            "the 30-year is sitting at 6.990%" (three decimals)
 *            "the 30-year fixed is sitting around 5.5%" / "rates are around
 *            6.25%" (A7: noun, connectives, figure — released under K-13)
 *            "your new rate could be 5.5%" (PROSPECTIVE offer, not existing rate)
 *            "your rate will be 5.5%" / "your rate would be 5.5%" (FUTURE-TENSE
 *            quote = a prospective offer, not the lead's existing rate — v0.5.0)
 *   ALLOWS:  "6.1% APR on a 30-year fixed" (APR disclosed)
 *            "your current rate is 2.88%" (lead's OWN existing rate — Kelly)
 *            "you're sitting on a 2.94% rate" / "your 6.5% rate alert"
 *            "prices are up 5% from last year" / "values up 2.4% year over year"
 *            "mortgage applications rose 5%" (mortgage is not a rate noun)
 *            "I'm offering 6.1% on a 30-year fixed" — figure first, two words
 *            to the noun: still released (A7 widened noun-first only; pinned)
 *            "rates have eased lately" (DIRECTIONAL — no figure)
 *            "rates are down 3%" / "rates fell 3%" (D-70: a MOVEMENT, not a
 *            level — "fell to 6.1%" / "down 0.5% to 6.1%" keep the level)
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

// ── REG-Z numeric primitives ─────────────────────────────────────────────────
//
// A percentage-shaped token: "6", "6.1", "6.125" followed by % or "percent".
const PERCENT_TOKEN = /\b\d{1,2}(?:\.\d{1,3})?\s*(?:%|percent\b)/gi;

// Window (chars) scanned on each side of a RATE figure for the APR / own-rate escapes.
const WINDOW = 40;

// (RATE_CUES / VALUE_CUES retired by K-13 — the rule above decides rate-vs-not.)

// APR-present escape — an "APR"/"A.P.R." token near the % means the rate figure
// is properly Reg-Z-disclosed. This is the additive Reg-Z piece on top of
// detectsRateFigure (which only decides rate-vs-value, not APR-presence).
const APR_PRESENT = /\bapr\b|\ba\.p\.r\.|\bannual percentage rate\b/i;

// ── LEAD-OWNED-RATE escape (Kelly ruling 2026-06-03) ─────────────────────────
//
// A factual statement about the LEAD'S OWN EXISTING rate ("your current rate is
// 2.88%", "you're sitting on a 2.94% rate", "your 6.5% rate alert") is NOT an
// advertised consumer-credit offer — it does not pull in the Reg-Z §1026.24
// "trigger term" APR-disclosure obligation, because no credit is being offered.
// It mirrors the home-VALUE escape (VALUE_CUES): a % in a lead-owned-rate context
// is allowed UNLESS the surrounding text also frames a PROSPECTIVE OFFER (see
// OFFER_CUES below) — in which case it is an advertised rate and STILL flags.
//
// OWN-RATE CUES — possessive / existing-rate framing near the %:
//   your rate | your current rate | your existing rate | your locked(-in) rate |
//   their (current|existing) rate | rate alert | you're/you are sitting on |
//   your <N>% rate (possessive + figure + "rate") |
//   the rate you have/had/locked/got/are | you've/you're (on|paying) the rate
//
// SHARED SOURCE OF TRUTH (v0.5.0): exported so the LANE checker's AGENT
// `rate offer` rule reuses this EXACT regex (src/lanes/scan.ts imports it) — the
// two scanners must never drift two divergent own-rate definitions. The Python
// halves (python/rate_claims.py + python/lane_checker.py) mirror this verbatim.
export const OWN_RATE_CUES =
  /\byour\s+(?:current\s+|existing\s+|locked(?:[\s-]?in)?\s+)?rate\b|\btheir\s+(?:current\s+|existing\s+)?rate\b|\brate\s+alert\b|\byou(?:'re|\s+are)\s+sitting\s+on\b|\byour\s+\d{1,2}(?:\.\d{1,3})?\s*(?:%|percent)\s+rate\b|\bthe\s+rate\s+you(?:'?ve|'?re|\s+(?:have|had|locked|got|are))\b/i;

// OFFER GUARD — a PROSPECTIVE / advertised-offer framing. Even when a possessive
// "your … rate" cue is present, these turn the figure back into an advertised
// offer (NOT the lead's existing rate) so it STILL flags:
//   (your|a) new rate | rate could be | could be/get/drop/go/lock/save/qualify |
//   you could … | we could … | refi(nance) | get you (down) to | qualify for |
//   down to <rate> | as low as | lock you in | we can get/offer/lock |
//   will be | would be (FUTURE-TENSE quote = a prospective offer, not a fact —
//   added v0.5.0 so "your rate will be 5.5%" / "your rate would be 5.5%" stay
//   flagged in BOTH scanners; present-tense "your rate is 2.88%" stays allowed)
// Boundary: "your current rate is 2.88%" → existing fact, ALLOWED.
//           "your new rate could be 5.5%" / "your rate will be 5.5%" → prospective
//           offer, FLAGGED.
//
// SHARED SOURCE OF TRUTH (v0.5.0): exported alongside OWN_RATE_CUES for the LANE
// checker — same single-list discipline (no copy-paste divergence).
export const OFFER_CUES =
  /\bnew\s+rate\b|\bcould\s+(?:be|get|drop|go|lock|save|qualify)\b|\byou\s+could\b|\bwe\s+could\b|\brefi(?:nance)?\b|\bget\s+you\b|\bqualify\s+for\b|\bdown\s+to\b|\bas\s+low\s+as\b|\block\s+you\s+in\b|\bwe\s+can\s+(?:get|offer|lock)\b|\bwill\s+be\b|\bwould\s+be\b/i;

/** Window (chars) scanned on each side of a phrase match for own-rate/offer cues
 *  — shared with the LANE checker so both scanners use the identical proximity. */
export const OWN_RATE_WINDOW = WINDOW;

// ── K-13 (2026-09-15, Kelly's ruling via Rello #1327) — WHEN A PERCENT IS A
// RATE FIGURE. Applied here 2026-09-16 (K-30) after the cue-window read
// "2.4%" — a year-over-year home-value delta with the word "rates" inside 40
// characters — as a bare rate and sent a Big Star compose to the safe
// template. The window is gone. A percent is a rate figure only when
//   - a RATE NOUN — rate, rates, APR, fixed, N-year — sits immediately before
//     or after the figure with at most ONE preposition or verb between, in the
//     same clause (. ! ? ; : , or a line break ends it); since A7 (below) a
//     noun BEFORE the figure may sit up to four connective words away; or
//   - the figure carries three decimals ("6.990%").
// A preposition never anchors ("at 20% down", "sits at 3% above" release); a
// rate word elsewhere in the clause does not ("mortgage applications rose 5%",
// "values up 2.4% year over year near the mortgage" release). The same regexes
// as Rello's send-time `containsRateClaim` — one rule, two homes, byte-equal
// until A7: Rello's copy keeps the one-word window until its consumer unit.
// The APR-present and lead-owned-rate escapes below still apply to a figure
// the rule classifies as a rate.
const CLAUSE_BOUNDARY_RE = /[.!?;:,\n]/;
/** The nouns that make a percent a rate figure. */
const RATE_NOUN_RE = /^(?:rates?|apr|fixed|\d{1,2}-?year)$/i;
/** The ONE word allowed between the noun and the figure: a preposition or a verb. */
const RATE_BRIDGE_RE =
  /^(?:of|at|near|around|about|to|from|under|below|above|over|by|in|on|is|are|was|were|be|been|hit|hits|reached?|sits?|sitting|sat|hovers?|hovering|hovered|remains?|stays?|holds?|holding|held|averages?|averaged|averaging|drops?|dropped|fell|falls?|rose|rises?|climbed|climbs?|moved?|moves|starts?|starting)$/i;
const WORD_RE = /[a-z0-9][a-z0-9'.-]*/gi;

// ── A7 (2026-09-24): the noun-first direction governs across a bounded phrase.
// K-13 allowed one bridge word, so "Rates are around 6.25%" and "the average
// 30-year rate sits near 6.3%" were not rate figures: they skipped the Reg-Z
// check, and Milo's A3 grounding accepted them as market values. A rate noun
// now governs a figure that follows it when EVERY word between them is a
// connective (a bridge word above, an auxiliary, or a time/approximation
// adverb) and there are at most RATE_PHRASE_MAX_WORDS of them. A noun in
// between ("rate cuts lifted sales 5%", "fixed costs rose 3%") still breaks the
// phrase, so the K-13/K-30 market releases hold. Measured on 2,624 ClearPath
// bodies (30 days, EmailBody + Milo final outputs, 2026-09-24): all 15 distinct
// rate sentences sat 3–6 words after the noun; 13 of 15 within 4. The two past
// 4 put a relative clause in between ("the 30-year fixed I'm quoting right now
// is") and carried three decimals, which catches them anyway.
// The figure-first direction ("6.1% on a 30-year fixed") keeps the one-word
// K-13 bridge: widening it reads "3.5% on a 30-year loan", a down payment.
/** Most connective words allowed between a rate noun and the figure after it. */
export const RATE_PHRASE_MAX_WORDS = 4;
/** Words that may sit between a rate noun and its figure: the K-13 bridge words plus auxiliaries and time/approximation adverbs. No nouns, no articles. */
const RATE_CONNECTIVE_RE =
  /^(?:has|have|had|being|will|would|could|can|may|might|should|currently|now|today|still|just|right|roughly|approximately|nearly|almost|sitting|running|trending|down|again|lately|recently|already|only)$/i;

function isConnective(word: string): boolean {
  return RATE_BRIDGE_RE.test(word) || RATE_CONNECTIVE_RE.test(word);
}

// ── D-70 (2026-09-24, auditor row A-178): a rate MOVEMENT is not a rate figure.
// A percentage governed by a movement verb is a delta or a market statement,
// not an advertised rate ("Rates are down 3%", "Rates fell 3%", "Rates have
// dropped roughly 0.5%"), UNLESS it is stated as a LEVEL ("fell to 6.1%",
// "down to 6.1%", "is 6.1%", "sits near 6.1%") or carries three decimals
// (checked first, in isRateFigure). The K-30 class (YoY deltas), generalised
// from "year over year" to the verb. Reading: in the noun-first phrase, find
// the LAST movement verb before the figure; if no level word follows it, the
// figure is a delta and the noun does not govern it. "Rates are down 0.5% to
// 6.1%": 0.5% is the delta, 6.1% the level. A prior figure followed by "to"
// ("0.5% to", "from 7% to") bridges, so the level after it is still read.
const RATE_MOVEMENT_RE =
  /^(?:ris(?:e|es|en|ing)|rose|fall(?:s|en|ing)?|fell|drop(?:s|ped|ping)?|down|up|lift(?:s|ed|ing)?|cut(?:s|ting)?|climb(?:s|ed|ing)?|slip(?:s|ped|ping)?|eas(?:e|es|ed|ing))$/i;
/** Words that, after a movement verb, state where the rate IS rather than how far it moved. */
const RATE_LEVEL_RE =
  /^(?:to|at|from|is|are|was|were|be|been|sits?|sat|sitting|near|around|hovers?|hovered|hovering|holds?|holding|held|stays?|stayed|remains?|remained|averages?|averaged|averaging)$/i;
const NUMBER_RE = /^\d{1,2}(?:\.\d{1,3})?$/;

/** D-70: does this noun-first bridge (words between the noun and the figure) describe a movement, not a level? */
function isMovementBridge(bridge: readonly string[]): boolean {
  let last = -1;
  for (let i = bridge.length - 1; i >= 0; i--) {
    if (RATE_MOVEMENT_RE.test(bridge[i])) { last = i; break; }
  }
  if (last < 0) return false;
  return !bridge.slice(last + 1).some((w) => RATE_LEVEL_RE.test(w));
}

/** The words of `text` in order, dropping a trailing period (so "6.5%." tokenises cleanly). */
function words(text: string): string[] {
  return (text.match(WORD_RE) ?? []).map((w) => w.replace(/\.$/, ""));
}

/** True when a rate noun governs the figure that sits between `before` and `after` within one clause (A7 phrase before it, K-13 one-word bridge after it). */
function rateNounGoverns(before: string, after: string): boolean {
  const pre = words(before);
  const post = words(after);
  // Noun first: walk back over at most RATE_PHRASE_MAX_WORDS connectives to a
  // rate noun. A prior figure followed by "to" bridges ("down 0.5% to 6.1%").
  // D-70: a noun whose phrase is a movement does not govern the figure.
  for (let i = pre.length - 1, bridged = 0; i >= 0 && bridged <= RATE_PHRASE_MAX_WORDS; i--) {
    if (RATE_NOUN_RE.test(pre[i])) {
      if (isMovementBridge(pre.slice(i + 1))) break;
      return true;
    }
    const numberBeforeTo = NUMBER_RE.test(pre[i]) && pre[i + 1]?.toLowerCase() === "to";
    if (!isConnective(pre[i]) && !numberBeforeTo) break;
    bridged++;
  }
  // Figure first: the K-13 rule, one bridge word at most.
  const n1 = post[0];
  const n2 = post[1];
  if (n1 && RATE_NOUN_RE.test(n1)) return true;
  if (n1 && n2 && RATE_BRIDGE_RE.test(n1) && RATE_NOUN_RE.test(n2)) return true;
  return false;
}

/** The clause containing [from, to): text between the nearest clause boundaries. */
/** A clause boundary at `i` — except a decimal point or thousands comma between digits ("0.5%", "1,200"), which ends nothing. D-70. */
function isClauseBoundaryAt(text: string, i: number): boolean {
  if (!CLAUSE_BOUNDARY_RE.test(text[i])) return false;
  if ((text[i] === "." || text[i] === ",") && /\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) return false;
  return true;
}

function clauseAround(text: string, from: number, to: number): { before: string; after: string } {
  let start = 0;
  for (let i = from - 1; i >= 0; i--) {
    if (isClauseBoundaryAt(text, i)) { start = i + 1; break; }
  }
  let end = text.length;
  for (let i = to; i < text.length; i++) {
    if (isClauseBoundaryAt(text, i)) { end = i; break; }
  }
  return { before: text.slice(start, from), after: text.slice(to, end) };
}

/** K-13: is the percent token at [idx, idx+len) of `masked` a RATE figure? */
function isRateFigure(masked: string, idx: number, len: number, digits: string): boolean {
  if (/\.\d{3}$/.test(digits)) return true;
  const { before, after } = clauseAround(masked, idx, idx + len);
  return rateNounGoverns(before, after);
}

/**
 * K-13 as a primitive for consumers that must know WHAT a percent means before
 * grounding it (Milo's validatePercentages, A3 2026-09-16): every percent token
 * in `text` with whether a rate noun governs it (or it carries three decimals).
 * HTML is masked first (offsets preserved). Pure; never throws.
 */
export interface PercentFigure {
  readonly index: number
  readonly matchedText: string
  readonly isRateFigure: boolean
}
export function classifyPercentFigures(text: string): readonly PercentFigure[] {
  if (typeof text !== "string" || text.length === 0) return []
  const lower = maskHtml(text).toLowerCase()
  const out: PercentFigure[] = []
  PERCENT_TOKEN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PERCENT_TOKEN.exec(lower)) !== null) {
    const idx = m.index
    if (PERCENT_TOKEN.lastIndex === idx) PERCENT_TOKEN.lastIndex++
    const digits = m[0].replace(/\s*(?:%|percent)$/i, "")
    out.push({ index: idx, matchedText: text.slice(idx, idx + m[0].length), isRateFigure: isRateFigure(lower, idx, m[0].length, digits) })
  }
  return out
}

function scanRegZ(text: string, masked: string): Array<{ index: number; matchedText: string }> {
  const lower = masked.toLowerCase();
  const out: Array<{ index: number; matchedText: string }> = [];

  PERCENT_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PERCENT_TOKEN.exec(lower)) !== null) {
    const idx = m.index;
    if (PERCENT_TOKEN.lastIndex === idx) PERCENT_TOKEN.lastIndex++; // zero-width guard

    // K-13: not a rate figure → not a Reg-Z trigger term, whatever sits nearby.
    const digits = m[0].replace(/\s*(?:%|percent)$/i, "");
    if (!isRateFigure(lower, idx, m[0].length, digits)) continue;

    const start = Math.max(0, idx - WINDOW);
    const end = Math.min(lower.length, idx + m[0].length + WINDOW);
    const ctx = lower.slice(start, end);

    // Allow a properly Reg-Z-disclosed rate: an APR token sits near the %.
    if (APR_PRESENT.test(ctx)) continue;

    // Allow the LEAD'S OWN EXISTING rate (Kelly ruling): an own-rate cue near the
    // % AND no prospective-OFFER framing → a factual statement about the
    // customer's existing rate, outside Reg-Z trigger-term scope. The OFFER guard
    // keeps "your new rate could be 5.5%" flagged (advertised offer, not a fact).
    if (OWN_RATE_CUES.test(ctx) && !OFFER_CUES.test(ctx)) continue;

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
