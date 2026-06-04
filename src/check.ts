/**
 * The context-aware M7 prohibited-language checker — NOT a substring scan.
 *
 * A token produces a `Violation` ONLY IF it matches at a word boundary AND none
 * of its `allowedContexts` fires (negation / fixed-compound / caller-marked
 * disclaimer-banner). This is the spec's correctness bar: it lets the 7 live
 * ACTIVE HecmContent NOT-THAT rows + "USDA guarantee fee" + the Report-Engine
 * illustrative banner pass, while a real affirmative claim ("we guarantee
 * approval") fails.
 *
 * The matching mechanics (tokenize / mask-HTML / compile / negation-compound-
 * disclaimer excusal) live in `src/match-engine.ts` — the single shared engine
 * also used by the role-aware lane checker (`src/lanes.ts`). This module is the
 * M7-vocabulary-specific decoration over that engine.
 *
 * Pure function over text; no tenant data, no I/O, no throw on bad input.
 */

import {
  COMPLIANCE_REGISTRY,
  type ComplianceCategory,
  type ComplianceEntry,
} from "./registry/index.js";
import {
  compileMatcher,
  maskHtml,
  indexWords,
  runMatcher,
  type CompiledMatcher,
} from "./match-engine.js";

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

interface CompiledEntry {
  readonly entry: ComplianceEntry;
  readonly matcher: CompiledMatcher;
}

const COMPILED: readonly CompiledEntry[] = COMPLIANCE_REGISTRY.map((entry) => ({
  entry,
  matcher: compileMatcher(entry),
}));

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

  for (const { entry, matcher } of COMPILED) {
    for (const { index, matchedText } of runMatcher(matcher, text, masked, words, opts.disclaimerRanges)) {
      violations.push({
        token: entry.token,
        category: entry.category,
        index,
        matchedText,
        suggest: entry.suggest,
        message: buildMessage(entry, matchedText, index),
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
