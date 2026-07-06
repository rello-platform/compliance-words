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
   * - `own-rate`: (lane checker only, v0.5.0) the match sits in a context that
   *   references the LEAD'S OWN EXISTING rate (`OWN_RATE_CUES` near the match) and
   *   carries NO prospective-offer framing (`OFFER_CUES` absent) → it is a factual
   *   statement about the customer's existing rate, not a rate OFFER, so it is
   *   allowed. Mirrors the rate-claims `scanRegZ` lead-owned-rate escape (Kelly
   *   ruling 2026-06-03) and REUSES the exact same shared cue regexes, so the two
   *   scanners agree. The M7 `checkCompliance` matcher does NOT implement this kind
   *   (no M7 row carries it); only `scanLaneViolations` honors it.
   */
  readonly kind: "negation" | "compound" | "disclaimer-banner" | "own-rate";
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

/**
 * List-aware negation window (Gap 3, v0.1.1). A real borrower disclaimer often
 * coordinates many NOT-THAT items under a single negation cue —
 * *"never call it an offer, a quote, an approval, a lock, or a pre-qualification"*
 * (15 words from `never` to `pre-qualification`); *"not a commitment to lend or a
 * guarantee of loan approval"* (`approval` is 10 words after `not`). The tight
 * {@link DEFAULT_NEGATION_PROXIMITY} window of 6 excused only the first item.
 *
 * When a token sits beyond the base window BUT a comma / `or` / `nor` coordinator
 * appears between it and an earlier negation cue (in the same clause — the scan
 * stops at a sentence terminator or a {@link CLAUSE_BREAKERS} word), the single
 * cue is treated as distributing over the whole coordinated list, up to this many
 * words. The coordinator requirement is what keeps this from over-excusing a
 * far-but-uncoordinated affirmative claim ("we never want you to feel pressured,
 * so … we guarantee a great rate" — `so` is a clause breaker, the scope stops).
 */
export const DEFAULT_LIST_NEGATION_PROXIMITY = 18;

/**
 * Words that mark a new clause — a negation cue does NOT distribute across one.
 * The backward negation scan stops here, so a negation in a prior clause of the
 * same sentence cannot excuse a token in a later clause. This is the guard that
 * makes the wider {@link DEFAULT_LIST_NEGATION_PROXIMITY} list window safe: it
 * extends negation across a coordinated list ("a, b, or c") but never across a
 * clause boundary ("…, so we guarantee…", "…, but we guarantee…").
 */
export const CLAUSE_BREAKERS: readonly string[] = [
  "so",
  "but",
  "because",
  "therefore",
  "thus",
  "then",
  "however",
  "meanwhile",
  "while",
  "although",
  "though",
  "yet",
  "since",
  "unless",
  "whereas",
];

/**
 * Coordinating words that (alongside a literal comma between words) signal a
 * coordinated list, enabling the {@link DEFAULT_LIST_NEGATION_PROXIMITY}
 * extension. `and` is intentionally EXCLUDED: it commonly joins independent
 * clauses ("…and we guarantee…") where the negation must NOT distribute; real M7
 * disclaimer lists coordinate their final item with `or`/`nor`.
 */
export const LIST_COORDINATORS: readonly string[] = ["or", "nor"];

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
 * The canonical M7 vocabulary. 13 prohibited tokens/phrases + the `AI` identity
 * rule = 14 rows. Gap-3 (v0.6.0) inverted approval/lock/pre-qualified to
 * allow-by-default phrase collocations, removed the bare `quote` token, and added
 * four new deny classes (rate-freeze, zero-cost, gov-affiliation,
 * manufactured-urgency).
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
        pattern: "guarantee fee",
        note: "The named loan-program 'guarantee fee' (USDA upfront/annual guarantee fee, '0.35% annual guarantee fee') is a real fee term, not an advertising claim. Broadened from 'usda guarantee fee' to cover the abbreviated/annual label uses found in live Report-Engine template copy (m7-baseline DOMAIN_COMPOUND_SOT_GAP, pfp_prequal_summary:150).",
      },
      {
        kind: "compound",
        pattern: "mip / guarantee",
        note: "The scenario-comparison column label 'MIP / Guarantee' (mortgage-insurance-premium vs. USDA guarantee-fee row). Live Report-Engine template label (m7-baseline DOMAIN_COMPOUND_SOT_GAP, pfp_scenario_comparison:187).",
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
      DISCLAIMER,
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
    // Gap-3 allow-by-default inversion (v0.6.0, Kelly 2026-07-06): the bare
    // `approval` word-stem HARD_BLOCKed ordinary conditional/procedural approval
    // language ("get pre-approved", "subject to underwriting approval", "once
    // approved by underwriting", "pending approval") — the exact institutional
    // GATE copy compliance WANTS. Inverted to allow-by-default: `approval` is now
    // a PHRASE that matches ONLY the affirmative-claim collocations. The
    // you're/you've-been pre-approved family is REQUIRED-blocked because a
    // definitive pre-approval statement to a consumer is an FCRA firm offer of
    // credit.
    token: "approval",
    matchType: "phrase",
    forms: [
      "you're approved",
      "you are approved",
      "you've been approved",
      "you have been approved",
      "get approved",
      "get you approved",
      "i'll get you approved",
      "instant approval",
      "guaranteed approval",
      "immediate approval",
      "fast approval",
      "approved today",
      "approved now",
      "approved in minutes",
      "you're pre-approved",
      "you are pre-approved",
      "you've been pre-approved",
      "you have been pre-approved",
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "review / pre-eligibility (if accurate)",
    provenance: [
      "S1",
      "S2",
      "S3",
      "RE",
      "Gap-3 allow-by-default inversion 2026-07-06; affirmative-claim collocations only; conditional/procedural approval language (get pre-approved, subject to underwriting approval, once approved by underwriting, pending approval) now passes; you're/you've-been pre-approved kept blocked = FCRA firm-offer.",
    ],
  },
  {
    // Gap-3 allow-by-default inversion (v0.6.0): the bare `lock` word-stem
    // false-blocked every named post-event product step ("rate lock", "lock
    // period", "once we lock"). Inverted to a PHRASE matching only the
    // affirmative pre-event rate-lock CTA.
    token: "lock",
    matchType: "phrase",
    forms: [
      "lock your rate",
      "lock in your rate",
      "lock your rate today",
      "lock in today",
      "rates locked in for you",
      "lock in your savings",
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION],
    suggest: "secure your rate (after a real lock)",
    provenance: [
      "S1",
      "S3",
      "RE",
      "Gap-3 inversion; affirmative pre-event rate-lock CTA only; rate lock / lock period / once we lock now pass.",
    ],
  },
  {
    // Gap 2 (v0.1.1): the bare `offer` stem false-blocked ordinary English —
    // "offer to include the family", "your real offered rate", "the MLO's offered
    // HECM rate", "record it when offered", "more trust than you could offer"
    // (live Rello fcn-expected-rate, hecm-v1-fcn-family-involved,
    // hecm-v1-fcn-trusted-contact-phone, obj-reverse-scams; RE
    // pfp_hecm_scenario_comparison:624). The PROHIBITED sense is the promotional
    // marketing collocation, not the verb/participle. So `offer` is narrowed from
    // a word-stem to a PHRASE that matches only the marketing collocations
    // (chosen mechanism (a) of the dispatch's Gap-2 options): ordinary verb/
    // participle uses now pass cleanly, while "limited-time offer" / "special
    // offer" / "offer expires" still HARD_BLOCK. Residual (documented): a bare
    // promotional NOUN with no qualifier ("here's our offer") is no longer caught
    // — acceptable, since such copy is rare and the unambiguous claim collocations
    // remain blocked.
    token: "offer",
    matchType: "phrase",
    forms: [
      "special offer",
      "exclusive offer",
      "limited offer",
      "limited-time offer",
      "limited time offer",
      "one-time offer",
      "one time offer",
      "best offer",
      "offer expires",
      "offer ends",
      "offer ends soon",
      "act now offer",
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "option / scenario",
    provenance: ["S1", "S3", "RE"],
  },
  {
    // Gap-3 allow-by-default inversion (v0.6.0): narrowed from a word-stem to a
    // PHRASE matching only the affirmative claim ("you're pre-qualified"). The
    // procedural CTA "get pre-qualified" and the product-name noun ("the
    // pre-qualification summary") now pass without needing compound allowances.
    token: "pre-qualified",
    matchType: "phrase",
    forms: [
      "you're pre-qualified",
      "you are pre-qualified",
      "you've been pre-qualified",
      "you have been pre-qualified",
      "instant pre-qualification",
      "guaranteed pre-qualification",
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "explore your options",
    provenance: [
      "S2",
      "Gap-3 inversion; affirmative claim only; get pre-qualified / the pre-qualification summary now pass.",
    ],
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
  {
    // Gap-3 new deny class (v0.6.0). Reg-Z: the same rate-stability promise as a
    // rate lock, made via a synonym ("freeze"/"hold") before any real lock event.
    token: "rate-freeze",
    matchType: "phrase",
    forms: [
      "freeze your rate",
      "rate freeze",
      "hold your rate",
      "rate hold",
      "freeze your savings",
      "freeze your payment",
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "secure your rate (after a real lock)",
    provenance: ["Gap-3 2026-07-06 new deny class; Reg-Z rate-stability promise via a lock synonym (freeze/hold)."],
  },
  {
    // Gap-3 new deny class (v0.6.0). Reg N / MAP Rule: an unqualified free/no-cost
    // claim. "no lender fees" is intentionally NOT a form (Kelly-approved as a
    // factual statement).
    token: "zero-cost",
    matchType: "phrase",
    forms: [
      "no-cost loan",
      "zero-cost mortgage",
      "free refinance",
      "no closing costs",
      "completely free",
      "no cost to you",
      "absolutely free",
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "low-cost / an estimate of costs",
    provenance: ["Gap-3 2026-07-06 new deny class; Reg N / MAP Rule unqualified free/no-cost claim ('no lender fees' excluded as factual)."],
  },
  {
    // Gap-3 new deny class (v0.6.0). MAP Rule: implying government origin or
    // endorsement of a private mortgage product.
    token: "gov-affiliation",
    matchType: "phrase",
    forms: [
      "official housing notice",
      "official government notice",
      "stimulus relief mortgage",
      "government approved program",
      "federal mortgage relief",
      "national rate directive",
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "name the specific program (FHA/VA/USDA) plainly",
    provenance: ["Gap-3 2026-07-06 new deny class; MAP Rule implying government origin/endorsement."],
  },
  {
    // Gap-3 new deny class (v0.6.0). UDAAP: fabricated urgency / false-deadline
    // pressure copy.
    token: "manufactured-urgency",
    matchType: "phrase",
    forms: [
      "final notice",
      "notice of eligibility",
      "enrollment deadline",
      "your window closes today",
      "expires at midnight",
      "act now before",
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "state a real product expiration plainly, or drop the deadline",
    provenance: ["Gap-3 2026-07-06 new deny class; UDAAP fabricated-urgency / false-deadline pressure."],
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
