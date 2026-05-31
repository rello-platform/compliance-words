/**
 * @rello-platform/compliance-words — the canonical M7 prohibited-language registry.
 *
 * ONE structured row per prohibited token/phrase. This is the machine
 * source-of-truth that replaces the ≥6 divergent prose enumerations the M7 rule
 * was scattered across (binding spec §Current State). It is NOT a flat word list:
 * the `allowedContexts` model is the load-bearing part — seven live ACTIVE
 * `HecmContent` rows carry these tokens legitimately inside NOT-THAT / negation /
 * disclaimer-banner lines, and "USDA guarantee fee" is a benign domain compound.
 * A naive substring scan false-positives on all of them; the context model is what
 * lets a real affirmative claim fail while legitimate copy passes.
 *
 * Drift class: vocabulary-divergence-across-consumers (Guard-Kit instance #8).
 * NO normalizer — there are no legacy alias forms to fold; the context-rule model
 * is the boundary logic, not a normalize-fold (Guard-Kit §4 archetype "NONE").
 *
 * Vocabulary verbatim from `_SPEC-M7-COMPLIANCE-WORDS-SOT.md` §Seed vocabulary
 * (the spec's reconciled, authoritative table). Provenance source IDs (S1…S6, RE,
 * CLAUDE.md) trace each token to the prose enumerations it was reconciled from.
 */

export type ComplianceCategory = "HARD_BLOCK" | "REVIEW_FLAG";

/**
 * How a token's surface forms are matched.
 * - `word-stem`: matches the explicitly-enumerated inflected `forms` at a word
 *   boundary (NOT substring — `quote` does not match `quotient`, `lock` does not
 *   match `block`/`o'clock`, `final` does not match `finalize`). Stem handling is
 *   DECLARED per token (the `forms` array), not derived from an opaque stemmer, so
 *   it is reviewable and the Python re-implementation matches byte-for-byte.
 * - `phrase`: matches the ordered word sequence allowing intervening
 *   whitespace/punctuation (`free money`, `won't lose your home`, `risk-free`).
 * - `word`: a single whole word matched CASE-SENSITIVELY with no stem (only `AI`,
 *   the identity rule — so `email`/`detail`/`OpenAI` never match).
 */
export type MatchType = "word-stem" | "phrase" | "word";

export interface AllowedContext {
  /**
   * - `negation`: the token is within `proximity` words AFTER a negation cue
   *   (not|isn't|never|no|cannot|won't…) in the same sentence → allowed.
   * - `compound`: the token is part of a registered fixed multi-word term in which
   *   it is legitimate (e.g. "usda guarantee fee", "rate-lock confirmation",
   *   "final disclosure") → allowed.
   * - `disclaimer-banner`: the token's char offset falls inside a range the CALLER
   *   marked as an illustrative/disclaimer block (`CheckOptions.disclaimerRanges`)
   *   → allowed. Fail-safe-strict: an unmarked banner still HARD_BLOCKs.
   */
  readonly kind: "negation" | "compound" | "disclaimer-banner";
  /** Documented, reviewable matcher. For `compound` this is the fixed phrase the
   *  checker searches for; for `negation`/`disclaimer-banner` it is human-readable
   *  documentation of the rule (the mechanism is generic, not pattern-parsed). */
  readonly pattern: string;
  /** For `kind:'negation'` — how many words before the match the cue may sit.
   *  Defaults to {@link DEFAULT_NEGATION_PROXIMITY} when omitted. */
  readonly proximity?: number;
  /** Why this context is allowed — cites the live evidence / domain rationale. */
  readonly note: string;
}

export interface ComplianceEntry {
  /** Canonical lowercase base/lemma — the stable identity of the row. */
  readonly token: string;
  readonly matchType: MatchType;
  /** The explicit surface forms to match (stem handling made reviewable). For
   *  `phrase`/`word` this is the phrase/word itself (+ benign spelling variants). */
  readonly forms: readonly string[];
  readonly category: ComplianceCategory;
  readonly allowedContexts: readonly AllowedContext[];
  /** Canonical substitution shown in the failure message. */
  readonly suggest?: string;
  /** Source IDs (S1…S6, RE, CLAUDE.md) this token was reconciled from. */
  readonly provenance: readonly string[];
}

/**
 * Negation cues. A `kind:'negation'` allowance fires when one of these appears
 * within the allowance's `proximity` words before the match, in the same sentence.
 * Superset of the spec §matching-contract list (`not|isn't|aren't|never|no|cannot|
 * can't|won't|doesn't`) plus the obvious siblings (`don't|isn`t variants|without|
 * nor|neither`).
 */
export const NEGATION_CUES: readonly string[] = [
  "not",
  "no",
  "never",
  "cannot",
  "without",
  "nor",
  "neither",
  // contracted forms (the apostrophe is normalized to a straight ' before match)
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "won't",
  "can't",
  "don't",
  "doesn't",
  "didn't",
  "wouldn't",
  "shouldn't",
  "couldn't",
];

/** Default words-before-match window for a `kind:'negation'` allowance. */
export const DEFAULT_NEGATION_PROXIMITY = 6;

const NEGATION: AllowedContext = {
  kind: "negation",
  pattern: "negation cue (not|never|no|isn't|won't…) within proximity words before the match, same sentence",
  proximity: DEFAULT_NEGATION_PROXIMITY,
  note: "Affirmative-claim rule: the token is forbidden only as an affirmative claim. A negated/NOT-THAT use ('not a guarantee', 'this is not an approval') is compliant. Proven by the 7 live ACTIVE HecmContent rows (spec S3) whose forbidden tokens sit only inside NOT-THAT lines.",
};

const DISCLAIMER: AllowedContext = {
  kind: "disclaimer-banner",
  pattern: "match offset within a caller-supplied disclaimerRanges block",
  note: "Illustrative/disclaimer banners (Report-Engine ILLUSTRATIVE_BANNER 'Illustrative — not a loan offer, quote, or approval.'; Rello illustrative banners) legitimately name the forbidden tokens inside a clearly-marked disclaimer. The caller marks the range; fail-safe-strict if it does not (an unmarked banner HARD_BLOCKs).",
};

/**
 * The canonical M7 vocabulary. 10 prohibited tokens/phrases + the `AI` identity
 * rule = 11 rows, verbatim from the spec's reconciled seed table.
 */
export const COMPLIANCE_REGISTRY: readonly ComplianceEntry[] = [
  {
    token: "guarantee",
    matchType: "word-stem",
    forms: ["guarantee", "guaranteed", "guarantees", "guaranteeing"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "usda guarantee fee",
        note: "USDA's named 'guarantee fee' is a real loan-program term, not an advertising claim.",
      },
      {
        kind: "compound",
        pattern: "loan guarantee program",
        note: "Named government program (e.g. VA/USDA loan guarantee program).",
      },
      {
        kind: "compound",
        pattern: "guarantee of value",
        note: "'not a guarantee of value' appraisal/disclosure phrasing.",
      },
      NEGATION,
    ],
    suggest: "designed to / built to",
    provenance: ["S1", "S4", "S5", "S6", "RE"],
  },
  {
    token: "free money",
    matchType: "phrase",
    forms: ["free money"],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION],
    suggest: "no-cost / lender credit (if accurate)",
    provenance: ["S1", "S4", "S6", "RE"],
  },
  {
    token: "won't lose your home",
    matchType: "phrase",
    forms: ["won't lose your home", "will not lose your home"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "negation",
        pattern: "objection-handler / negation line",
        proximity: DEFAULT_NEGATION_PROXIMITY,
        note: "Objection-handler copy ('a common worry is you \"won't lose your home\" — here's the reality…') frames it as a cited fear, not an affirmative promise.",
      },
      DISCLAIMER,
    ],
    suggest: "(rephrase as a factual non-recourse explanation)",
    provenance: ["S1", "S3", "RE"],
  },
  {
    token: "approval",
    matchType: "word-stem",
    forms: ["approval", "approvals", "approved", "approve", "approves", "approving"],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "review / pre-eligibility (if accurate)",
    provenance: ["S1", "S2", "S3", "RE"],
  },
  {
    token: "lock",
    matchType: "word-stem",
    forms: ["lock", "locked", "locks", "locking"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "rate-lock confirmation",
        note: "Named post-event transactional step (CLOSING_RELEVANT_TYPES `rate_lock_confirmation`); legitimate after a real lock.",
      },
      {
        kind: "compound",
        pattern: "rate lock",
        note: "'rate lock' as a named product step in transactional/closing copy (post-event), not an affirmative pre-event claim.",
      },
      NEGATION,
    ],
    suggest: "secure your rate (after a real lock)",
    provenance: ["S1", "S3", "RE"],
  },
  {
    token: "quote",
    matchType: "word-stem",
    forms: ["quote", "quoted", "quotes", "quoting"],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "estimate / illustration",
    provenance: ["S1", "S2", "S3", "RE"],
  },
  {
    token: "offer",
    matchType: "word-stem",
    forms: ["offer", "offered", "offers", "offering"],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "option / scenario",
    provenance: ["S1", "S3", "RE"],
  },
  {
    token: "pre-qualified",
    matchType: "word-stem",
    forms: [
      "pre-qualified",
      "pre-qualify",
      "pre-qualifies",
      "pre-qualifying",
      "pre-qualification",
      "prequalified",
      "prequalify",
      "prequalification",
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION],
    suggest: "explore your options",
    provenance: ["S2"],
  },
  {
    token: "risk-free",
    matchType: "phrase",
    forms: ["risk-free", "risk free"],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION],
    suggest: "(delete — no compliant substitute)",
    provenance: ["S5"],
  },
  {
    token: "final",
    matchType: "word-stem",
    forms: ["final", "finals"],
    category: "REVIEW_FLAG",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "final disclosure",
        note: "TRID 'Final Disclosure' / 'Closing Disclosure' is a named legal document.",
      },
      {
        kind: "compound",
        pattern: "final tila",
        note: "'Final TILA' is a named legal disclosure.",
      },
      {
        kind: "compound",
        pattern: "final walkthrough",
        note: "'final walkthrough' is a named closing step.",
      },
      NEGATION,
    ],
    suggest: "(human review)",
    provenance: ["S3"],
  },
  {
    token: "AI",
    matchType: "word",
    forms: ["AI"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "open ai",
        note: "External proper noun (OpenAI). Belt-and-suspenders — the case-sensitive whole-word match already skips 'OpenAI' (no word boundary before 'AI').",
      },
      {
        kind: "compound",
        pattern: "google ai",
        note: "External proper noun (a named third-party product, not a description of Milo).",
      },
      {
        kind: "compound",
        pattern: "microsoft ai",
        note: "External proper noun (a named third-party product).",
      },
      {
        kind: "compound",
        pattern: "meta ai",
        note: "External proper noun (a named third-party product).",
      },
    ],
    suggest: "Smart Assistant",
    provenance: ["CLAUDE.md", "S1", "S2", "RE"],
  },
];

/**
 * Frozen membership set of canonical token identities (runtime guard +
 * edit-distance hints). Mirrors the Guard-Kit `CANONICAL_X_SET` primitive.
 */
export const COMPLIANCE_TOKEN_SET: ReadonlySet<string> = new Set(
  COMPLIANCE_REGISTRY.map((entry) => entry.token),
);

/** SOT enumeration primitive — the canonical "all prohibited tokens" list. */
export function listComplianceEntries(): readonly ComplianceEntry[] {
  return COMPLIANCE_REGISTRY;
}
