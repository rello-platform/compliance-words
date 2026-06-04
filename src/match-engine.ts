/**
 * The shared context-aware matching engine.
 *
 * Extracted verbatim from the original `src/check.ts` so BOTH the M7
 * prohibited-language checker (`checkCompliance`) AND the role-aware lane checker
 * (`scanLaneViolations`) run over ONE matcher. There is exactly one place that
 * tokenizes, masks HTML, compiles boundary-anchored patterns, and decides whether
 * a match is excused by a negation / compound / disclaimer-banner context — so the
 * two checkers can never drift apart, and the Python re-implementation
 * (Report-Engine `app/compliance/checker.py`) mirrors a single, stable algorithm.
 *
 * Matching contract (unchanged from v0.1.x):
 *   1. Tokenize on word boundaries. `word-stem`/`word` match enumerated forms at a
 *      boundary (never substring). `phrase` matches the ordered word sequence with
 *      intervening whitespace/punctuation. `word` is matched CASE-SENSITIVELY.
 *   2. Negation — a cue within `proximity` words before the match (same clause),
 *      or within the wider list window when a comma/`or`/`nor` coordinator lies
 *      between the cue and the match.
 *   3. Compound — the match sits inside a registered fixed compound.
 *   4. Disclaimer-banner — the match offset is inside a caller-supplied range.
 *   5. Otherwise → the match is a live hit.
 *
 * Pure functions over text; no tenant data, no I/O, no throw on bad input.
 */

import {
  NEGATION_CUES,
  DEFAULT_NEGATION_PROXIMITY,
  DEFAULT_LIST_NEGATION_PROXIMITY,
  CLAUSE_BREAKERS,
  LIST_COORDINATORS,
  type MatchType,
  type AllowedContext,
} from "./registry/index.js";

// ── Regex compilation primitives ─────────────────────────────────────────────

const WORD_CHAR = "A-Za-z0-9";
const BOUNDARY_BEFORE = `(?<![${WORD_CHAR}])`;
const BOUNDARY_AFTER = `(?![${WORD_CHAR}])`;
const SEP = `[^${WORD_CHAR}]+`; // ≥1 non-word char between phrase words
const SENTENCE_TERMINATOR = /[.!?;\n]/;
const NEGATION_SET: ReadonlySet<string> = new Set(NEGATION_CUES);
const CLAUSE_BREAKER_SET: ReadonlySet<string> = new Set(CLAUSE_BREAKERS);
const LIST_COORDINATOR_SET: ReadonlySet<string> = new Set(LIST_COORDINATORS);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeApostrophe(s: string): string {
  return s.replace(/[‘’ʼ]/g, "'");
}

/**
 * Compile a phrase/compound into a boundary-anchored pattern that allows
 * intervening whitespace/punctuation between words, optional apostrophes, and
 * hyphen-or-space between hyphenated words.
 */
export function compilePhrasePattern(phrase: string): string {
  let out = BOUNDARY_BEFORE;
  let pendingSep = false;
  for (const ch of phrase) {
    if (/[A-Za-z0-9]/.test(ch)) {
      if (pendingSep) {
        out += SEP;
        pendingSep = false;
      }
      out += escapeRegex(ch);
    } else if (ch === "'" || ch === "’" || ch === "‘") {
      out += "['‘’]?";
    } else {
      // whitespace / hyphen / other punctuation → word separator
      pendingSep = true;
    }
  }
  return out + BOUNDARY_AFTER;
}

export function compileFormPattern(form: string, matchType: MatchType): string {
  if (matchType === "phrase") return compilePhrasePattern(form);
  // word-stem / word: enumerated surface form matched literally at a boundary.
  return BOUNDARY_BEFORE + escapeRegex(form) + BOUNDARY_AFTER;
}

/**
 * A row the engine can scan: a set of surface `forms` (compiled per `matchType`)
 * plus the `allowedContexts` that excuse a match. Both `ComplianceEntry` and
 * `LaneEntry` satisfy this shape — the engine only needs the matchable fields.
 */
export interface MatchableEntry {
  readonly matchType: MatchType;
  readonly forms: readonly string[];
  readonly allowedContexts: readonly AllowedContext[];
}

export interface CompiledMatcher {
  readonly tokenRegex: RegExp;
  readonly compoundRegexes: readonly RegExp[];
  readonly hasNegation: boolean;
  readonly negationProximity: number;
  readonly listNegationProximity: number;
  readonly hasDisclaimer: boolean;
}

/** Compile one matchable entry's regexes + context flags (once, at module load). */
export function compileMatcher(entry: MatchableEntry): CompiledMatcher {
  const caseSensitive = entry.matchType === "word"; // only `AI`-style identity rules
  const flags = caseSensitive ? "g" : "gi";
  const tokenPattern = entry.forms
    .map((f) => compileFormPattern(f, entry.matchType))
    .join("|");
  const compoundRegexes = entry.allowedContexts
    .filter((c) => c.kind === "compound")
    .map((c) => new RegExp(compilePhrasePattern(c.pattern), "gi"));
  const negation = entry.allowedContexts.find((c) => c.kind === "negation");
  return {
    tokenRegex: new RegExp(tokenPattern, flags),
    compoundRegexes,
    hasNegation: Boolean(negation),
    negationProximity: negation?.proximity ?? DEFAULT_NEGATION_PROXIMITY,
    listNegationProximity: DEFAULT_LIST_NEGATION_PROXIMITY,
    hasDisclaimer: entry.allowedContexts.some((c) => c.kind === "disclaimer-banner"),
  };
}

// ── HTML masking (preserves offsets 1:1) ─────────────────────────────────────

/**
 * Replace every `<...>` tag with spaces of equal length so offsets are preserved
 * 1:1. Effect: `<b>guarantee</b>` → the token is caught at its true offset, while
 * `quote` inside `<a href="quote.html">` is masked (inside the tag) and ignored.
 */
export function maskHtml(text: string): string {
  return text.replace(/<[^>]*>/g, (m) => " ".repeat(m.length));
}

// ── Word index (for negation scan) ───────────────────────────────────────────

export interface Word {
  readonly text: string;
  readonly start: number;
  readonly end: number; // exclusive
}

export function indexWords(masked: string): Word[] {
  const words: Word[] = [];
  const re = /[A-Za-z0-9'‘’]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    words.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return words;
}

function wordIndexForMatch(words: Word[], offset: number): number {
  // The word-token list includes apostrophes, so a token may START before the
  // boundary-anchored match offset. Return the first word ENDING after the offset.
  for (let i = 0; i < words.length; i++) {
    if (offset < words[i].end) return i;
  }
  return words.length;
}

/**
 * Is the match excused by a negation cue earlier in the same clause? (Two ways:
 * DIRECT within `proximity`, or LIST-DISTRIBUTED within `listProximity` when a
 * coordinator lies between the cue and the match.) Verbatim from the original
 * `src/check.ts::isNegated`.
 */
export function isNegated(
  masked: string,
  words: Word[],
  matchOffset: number,
  proximity: number,
  listProximity: number,
): boolean {
  const w = wordIndexForMatch(words, matchOffset);
  let sawCoordinator = false;
  const floor = Math.max(0, w - listProximity);
  for (let j = w - 1; j >= floor; j--) {
    const next = words[j + 1];
    const rightEdge = next ? next.start : matchOffset;
    const gap = masked.slice(words[j].end, rightEdge);
    if (SENTENCE_TERMINATOR.test(gap)) break; // crossed a sentence boundary
    if (gap.includes(",")) sawCoordinator = true;
    const cue = normalizeApostrophe(words[j].text.toLowerCase()).replace(/^'+|'+$/g, "");
    if (CLAUSE_BREAKER_SET.has(cue)) break; // negation does not cross a clause boundary
    if (NEGATION_SET.has(cue)) {
      const dist = w - j;
      if (dist <= proximity) return true; // (1) direct
      if (sawCoordinator) return true; // (2) list-distributed
      break; // a cue this far with no coordination does not negate; stop
    }
    if (LIST_COORDINATOR_SET.has(cue)) sawCoordinator = true;
  }
  return false;
}

export function withinAnyRange(
  offset: number,
  ranges: ReadonlyArray<readonly [number, number]> | undefined,
): boolean {
  if (!ranges) return false;
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

export function withinAnyCompound(
  offset: number,
  spans: ReadonlyArray<readonly [number, number]>,
): boolean {
  return spans.some(([start, end]) => offset >= start && offset < end);
}

export interface RawMatch {
  /** Char offset of the match in the ORIGINAL input text. */
  readonly index: number;
  readonly matchedText: string;
}

/**
 * Run one compiled matcher over `masked`/`words` and return every match that is
 * NOT excused by a compound / disclaimer-banner / negation context. The caller
 * decorates each `RawMatch` with token-specific metadata (category / severity /
 * message). `text` is the original (unmasked) string, used only to slice the
 * matched surface text at its true offset.
 */
export function runMatcher(
  compiled: CompiledMatcher,
  text: string,
  masked: string,
  words: Word[],
  disclaimerRanges: ReadonlyArray<readonly [number, number]> | undefined,
): RawMatch[] {
  const out: RawMatch[] = [];

  // Pre-compute compound spans for this entry (small, per-entry).
  const compoundSpans: Array<readonly [number, number]> = [];
  for (const cre of compiled.compoundRegexes) {
    cre.lastIndex = 0;
    let cm: RegExpExecArray | null;
    while ((cm = cre.exec(masked)) !== null) {
      compoundSpans.push([cm.index, cm.index + cm[0].length]);
      if (cm.index === cre.lastIndex) cre.lastIndex++; // zero-width guard
    }
  }

  compiled.tokenRegex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = compiled.tokenRegex.exec(masked)) !== null) {
    const index = m.index;
    const matchedText = text.slice(index, index + m[0].length);

    if (compiled.tokenRegex.lastIndex === index) compiled.tokenRegex.lastIndex++; // zero-width guard

    if (withinAnyCompound(index, compoundSpans)) continue;
    if (compiled.hasDisclaimer && withinAnyRange(index, disclaimerRanges)) continue;
    if (
      compiled.hasNegation &&
      isNegated(masked, words, index, compiled.negationProximity, compiled.listNegationProximity)
    ) {
      continue;
    }

    out.push({ index, matchedText });
  }

  return out;
}
