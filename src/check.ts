/**
 * The context-aware compliance checker — NOT a substring scan.
 *
 * A token produces a `Violation` ONLY IF it matches at a word boundary AND none
 * of its `allowedContexts` fires (negation / fixed-compound / caller-marked
 * disclaimer-banner). This is the spec's correctness bar: it lets the 7 live
 * ACTIVE HecmContent NOT-THAT rows + "USDA guarantee fee" + the Report-Engine
 * illustrative banner pass, while a real affirmative claim ("we guarantee
 * approval") fails.
 *
 * Matching contract (spec §The matching contract):
 *   1. Tokenize on word boundaries. `word-stem`/`word` match enumerated forms at a
 *      boundary (never substring). `phrase` matches the ordered word sequence with
 *      intervening whitespace/punctuation. `AI` is matched CASE-SENSITIVELY.
 *   2. Negation — a cue within `proximity` words before the match (same sentence).
 *   3. Compound — the match sits inside a registered fixed compound.
 *   4. Disclaimer-banner — the match offset is inside a caller-supplied range.
 *   5. Otherwise → emit a Violation (category + suggest + actionable message).
 *
 * Pure function over text; no tenant data, no I/O, no throw on bad input.
 */

import {
  COMPLIANCE_REGISTRY,
  NEGATION_CUES,
  DEFAULT_NEGATION_PROXIMITY,
  DEFAULT_LIST_NEGATION_PROXIMITY,
  CLAUSE_BREAKERS,
  LIST_COORDINATORS,
  type ComplianceCategory,
  type ComplianceEntry,
} from "./registry/index.js";

export interface CheckOptions {
  /** Char ranges `[startInclusive, endExclusive]` the caller marked as an
   *  illustrative/disclaimer block. A token whose offset falls inside one of
   *  these ranges is allowed IFF its entry declares a `disclaimer-banner`
   *  context. Fail-safe-strict: an unmarked banner still HARD_BLOCKs. */
  readonly disclaimerRanges?: ReadonlyArray<readonly [number, number]>;
  /** Restrict the returned violations to these categories. Default: both. */
  readonly categories?: readonly ComplianceCategory[];
}

export interface Violation {
  readonly token: string;
  readonly category: ComplianceCategory;
  /** Char offset of the match in the ORIGINAL input text. */
  readonly index: number;
  readonly matchedText: string;
  readonly suggest?: string;
  /** Actionable, parameterized failure message (Guard-Kit §6 form). */
  readonly message: string;
}

// ── Regex compilation (once, at module load) ────────────────────────────────

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
function compilePhrasePattern(phrase: string): string {
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

function compileFormPattern(form: string, matchType: ComplianceEntry["matchType"]): string {
  if (matchType === "phrase") return compilePhrasePattern(form);
  // word-stem / word: enumerated surface form matched literally at a boundary.
  return BOUNDARY_BEFORE + escapeRegex(form) + BOUNDARY_AFTER;
}

interface CompiledEntry {
  readonly entry: ComplianceEntry;
  readonly tokenRegex: RegExp;
  readonly compoundRegexes: readonly RegExp[];
  readonly hasNegation: boolean;
  readonly negationProximity: number;
  readonly listNegationProximity: number;
  readonly hasDisclaimer: boolean;
}

const COMPILED: readonly CompiledEntry[] = COMPLIANCE_REGISTRY.map((entry) => {
  const caseSensitive = entry.matchType === "word"; // only `AI`
  const flags = caseSensitive ? "g" : "gi";
  const tokenPattern = entry.forms
    .map((f) => compileFormPattern(f, entry.matchType))
    .join("|");
  const compoundRegexes = entry.allowedContexts
    .filter((c) => c.kind === "compound")
    .map((c) => new RegExp(compilePhrasePattern(c.pattern), "gi"));
  const negation = entry.allowedContexts.find((c) => c.kind === "negation");
  return {
    entry,
    tokenRegex: new RegExp(tokenPattern, flags),
    compoundRegexes,
    hasNegation: Boolean(negation),
    negationProximity: negation?.proximity ?? DEFAULT_NEGATION_PROXIMITY,
    listNegationProximity: DEFAULT_LIST_NEGATION_PROXIMITY,
    hasDisclaimer: entry.allowedContexts.some((c) => c.kind === "disclaimer-banner"),
  };
});

// ── HTML masking (preserves offsets) ────────────────────────────────────────

/**
 * Replace every `<...>` tag with spaces of equal length so offsets are preserved
 * 1:1. Effect: `<b>guarantee</b>` → the token is caught at its true offset, while
 * `quote` inside `<a href="quote.html">` is masked (inside the tag) and ignored.
 */
function maskHtml(text: string): string {
  return text.replace(/<[^>]*>/g, (m) => " ".repeat(m.length));
}

// ── Word index (for negation scan) ──────────────────────────────────────────

interface Word {
  readonly text: string;
  readonly start: number;
  readonly end: number; // exclusive
}

function indexWords(masked: string): Word[] {
  const words: Word[] = [];
  const re = /[A-Za-z0-9'‘’]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    words.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return words;
}

function wordIndexForMatch(words: Word[], offset: number): number {
  // The word-token list includes apostrophes ("won't", and a quoted "'quote'"
  // tokenizes WITH its surrounding apostrophes), so a token may START before the
  // boundary-anchored match offset. Return the first word ENDING after the
  // offset — i.e. the word that contains the match, or the next word if the
  // match falls in a gap.
  for (let i = 0; i < words.length; i++) {
    if (offset < words[i].end) return i;
  }
  return words.length;
}

/**
 * Is the match excused by a negation cue earlier in the same clause?
 *
 * Two ways to be negated (Gap 3, v0.1.1 — list-aware):
 *   1. DIRECT: a cue within `proximity` words before the match (the v0.1.0 rule;
 *      `proximity` defaults to 6 and is unchanged for close cues).
 *   2. LIST-DISTRIBUTED: a cue up to `listProximity` words before the match, where
 *      a coordinated list (a comma between words, or an `or`/`nor`) appears between
 *      the cue and the match. This excuses every item of a NOT-THAT list under a
 *      single cue ("never call it an offer, a quote, an approval, a lock, or a
 *      pre-qualification"; "not a commitment to lend or a guarantee of loan
 *      approval").
 *
 * The scan stops at a sentence terminator OR a clause breaker (`so`, `but`, …) —
 * so a negation in a prior clause never distributes into a later one. The
 * coordinator requirement + clause-breaker stop are what keep the wider list
 * window from over-excusing a far, uncoordinated affirmative claim.
 */
function isNegated(
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
    // A literal comma between this word and the next (toward the match) is a list
    // coordinator — record it before inspecting the word itself.
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

function withinAnyRange(
  offset: number,
  ranges: ReadonlyArray<readonly [number, number]> | undefined,
): boolean {
  if (!ranges) return false;
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

function withinAnyCompound(offset: number, spans: ReadonlyArray<readonly [number, number]>): boolean {
  return spans.some(([start, end]) => offset >= start && offset < end);
}

function buildMessage(entry: ComplianceEntry, matchedText: string, index: number): string {
  const base = `✗ ${entry.category}: "${matchedText}" is M7 prohibited language ("${entry.token}") at offset ${index}`;
  return entry.suggest ? `${base} → use "${entry.suggest}" instead` : base;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Scan `text` for M7 prohibited language. Returns the violations that are NOT
 * excused by an allowed context. Empty/non-string input returns `[]` (no throw).
 */
export function checkCompliance(text: string, opts: CheckOptions = {}): readonly Violation[] {
  if (typeof text !== "string" || text.length === 0) return [];

  const masked = maskHtml(text);
  const words = indexWords(masked);
  const violations: Violation[] = [];

  for (const compiled of COMPILED) {
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

      // Resolve allowed contexts (any → not a violation).
      if (withinAnyCompound(index, compoundSpans)) continue;
      if (compiled.hasDisclaimer && withinAnyRange(index, opts.disclaimerRanges)) continue;
      if (
        compiled.hasNegation &&
        isNegated(masked, words, index, compiled.negationProximity, compiled.listNegationProximity)
      ) {
        continue;
      }

      violations.push({
        token: compiled.entry.token,
        category: compiled.entry.category,
        index,
        matchedText,
        suggest: compiled.entry.suggest,
        message: buildMessage(compiled.entry, matchedText, index),
      });
    }
  }

  violations.sort((a, b) => a.index - b.index || a.token.localeCompare(b.token));

  if (opts.categories) {
    const allow = new Set(opts.categories);
    return violations.filter((v) => allow.has(v.category));
  }
  return violations;
}

/** True iff `text` contains at least one HARD_BLOCK violation. */
export function hasHardBlock(text: string, opts: CheckOptions = {}): boolean {
  return checkCompliance(text, { ...opts, categories: ["HARD_BLOCK"] }).length > 0;
}
