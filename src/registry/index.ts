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
    token: "approval",
    matchType: "word-stem",
    forms: ["approval", "approvals", "approved", "approve", "approves", "approving"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "hud-approved",
        note: "Named federal designation: a 'HUD-approved counselor' / 'HUD-approved housing counselor' / 'HUD-approved condominium' / 'HUD-approved counseling' is a real HUD status, NOT an advertising approval claim. The mandatory HECM HUD-counseling line carries it on every compliant message (live Rello HecmContent comp-hud-counseling-mandatory, obj-reverse-scams, hecm-v1 property-type rows; Milo HUD-counseling line; RE pfp_hecm_scenario_comparison:92,417). Closes DISCOVERED-MILO-COMPLIANCE-WORDS-HUD-APPROVED-COMPOUND-MISSING-260531.",
      },
      {
        kind: "compound",
        pattern: "fha-approved",
        note: "Named federal designation: 'FHA-approved' / 'FHA/HUD-approved' condo/lender status, not an advertising claim (live Rello hecm-v1-card-property-type-eligibility:402, hecm-v1-fcn-property-type:309).",
      },
      {
        kind: "compound",
        pattern: "hud's approved list",
        note: "Reference to HUD's published list of approved condominium projects — a domain artifact, not a borrower approval claim (live Rello hecm-v1-card-property-type-eligibility:523, hecm-v1-fcn-property-type:424).",
      },
      {
        kind: "compound",
        pattern: "single-unit approval",
        note: "FHA Single-Unit Approval (SUA) — a named condominium-eligibility process, not a borrower approval claim (live Rello hecm-v1-card-property-type-eligibility:561).",
      },
      {
        kind: "compound",
        pattern: "condo approval",
        note: "FHA/HUD condominium-project approval process (the 'condo-approval field'), a named eligibility step, not a borrower approval claim (live Rello hecm-v1-fcn-property-type:474).",
      },
      // Ruling 2 (v0.1.2, Kelly 2026-06-01): compliance-REQUIRED disclaimer
      // collocations that name the INSTITUTIONAL approval GATE are PROTECTIVE
      // language, not an advertising claim. "subject to underwriting approval",
      // "subject to credit approval", "lender approval required", "approval is not
      // guaranteed" warn the borrower that approval is conditional — the opposite
      // of an inducement. Registered NARROWLY as institutional-gate nouns so the
      // genuine promotional claim STILL HARD_BLOCKs: "loan approval" ("Get loan
      // approval today"), bare "approved" ("you're approved!") and "guarantee
      // approval" carry no institutional-gate compound and remain blocked. Clears
      // live Report-Engine disclaimer copy (pfp_prequal_summary "…underwriting
      // approval are required"; nonqm_scenarios_compare "subject to underwriting
      // approval"). Closes Kelly-HALTED judgment #2.
      {
        kind: "compound",
        pattern: "underwriting approval",
        note: "Ruling 2 (Kelly 2026-06-01): the institutional underwriting gate ('subject to underwriting approval', '…underwriting approval are required') is a required protective disclaimer, not an advertising claim. Narrow institutional-gate noun — 'loan approval'/'approved'/'guarantee approval' still HARD_BLOCK.",
      },
      {
        kind: "compound",
        pattern: "credit approval",
        note: "Ruling 2 (Kelly 2026-06-01): 'subject to credit approval' is a required protective disclaimer naming the institutional credit gate, not an advertising claim.",
      },
      {
        kind: "compound",
        pattern: "lender approval",
        note: "Ruling 2 (Kelly 2026-06-01): 'lender approval required' / 'subject to lender approval' is a required protective disclaimer naming the institutional lender gate, not an advertising claim.",
      },
      {
        kind: "compound",
        pattern: "approval is not guaranteed",
        note: "Ruling 2 (Kelly 2026-06-01): 'approval is not guaranteed' is a protective disclaimer — the 'not'/'guaranteed' sit AFTER 'approval' so the generic negation rule cannot reach it; the fixed disclaimer phrase is registered explicitly.",
      },
      NEGATION,
      DISCLAIMER,
    ],
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
      {
        kind: "compound",
        pattern: "lock days",
        note: "The rate-lock-period column label 'Lock days' in scenario-comparison copy — a transactional field, not an affirmative lock claim (live Report-Engine pfp_scenario_comparison:359).",
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
    // Gap 3 (v0.1.1): added DISCLAIMER so a caller-marked illustrative/disclaimer
    // block naming 'pre-qualification' inside a NOT-THAT line passes, matching the
    // posture of approval/quote (P3 finding).
    //
    // Ruling 1 (v0.1.2, Kelly 2026-06-01): "pre-qualified" as a PRODUCT NAME is
    // identity, not an advertising claim. The split is grammatical and reliable:
    // the -ION NOUN "pre-qualification" / "prequalification" NAMES the product /
    // feature / document (the PathfinderPro "Pre-Qualification Summary", its
    // section/status labels, "this pre-qualification is based on…", "ask for an
    // official pre-qualification") — it is never the prohibited inducement. The
    // prohibited advertising claim is always the -ED ADJECTIVE/VERB applied to the
    // borrower ("you're pre-qualified!", "you are pre-qualified, lock your rate",
    // "get pre-qualified now") — those forms ("pre-qualified", "pre-qualify",
    // "pre-qualifies", "pre-qualifying", "prequalified", …) carry NO identity
    // compound and remain HARD_BLOCK. So the noun is registered as a product-name
    // identity compound (NOT removed from the token — per the ruling's mechanism)
    // while every adjective/verb form still blocks. Closes Kelly-HALTED judgment
    // #1. Residual (documented, surfaced to DKA): the 3rd-person status sentence
    // "<borrower> is pre-qualified" uses the -ED adjective and stays in scope —
    // deliberately, so the 2nd-person claim "you're pre-qualified" cannot slip;
    // the summary could title-case it to a "Pre-Qualified" badge if Kelly wants it
    // cleared too.
    allowedContexts: [
      {
        kind: "compound",
        pattern: "pre-qualification",
        note: "Ruling 1 (Kelly 2026-06-01): the -ION NOUN naming the product/feature/document ('Pre-Qualification Summary' title, the status labels, 'this pre-qualification is based on…', 'an official pre-qualification') is identity, not an advertising claim. The -ED adjective claim form ('you're pre-qualified') carries no compound and still HARD_BLOCKs.",
      },
      {
        kind: "compound",
        pattern: "prequalification",
        note: "Ruling 1 (Kelly 2026-06-01): the unhyphenated spelling of the product-name noun — same identity allowance as 'pre-qualification'.",
      },
      NEGATION,
      DISCLAIMER,
    ],
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
