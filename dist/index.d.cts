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
type ComplianceCategory = "HARD_BLOCK" | "REVIEW_FLAG";
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
type MatchType = "word-stem" | "phrase" | "word";
interface AllowedContext {
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
interface ComplianceEntry {
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
declare const NEGATION_CUES: readonly string[];
/** Default words-before-match window for a `kind:'negation'` allowance. */
declare const DEFAULT_NEGATION_PROXIMITY = 6;
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
declare const DEFAULT_LIST_NEGATION_PROXIMITY = 18;
/**
 * Words that mark a new clause — a negation cue does NOT distribute across one.
 * The backward negation scan stops here, so a negation in a prior clause of the
 * same sentence cannot excuse a token in a later clause. This is the guard that
 * makes the wider {@link DEFAULT_LIST_NEGATION_PROXIMITY} list window safe: it
 * extends negation across a coordinated list ("a, b, or c") but never across a
 * clause boundary ("…, so we guarantee…", "…, but we guarantee…").
 */
declare const CLAUSE_BREAKERS: readonly string[];
/**
 * Coordinating words that (alongside a literal comma between words) signal a
 * coordinated list, enabling the {@link DEFAULT_LIST_NEGATION_PROXIMITY}
 * extension. `and` is intentionally EXCLUDED: it commonly joins independent
 * clauses ("…and we guarantee…") where the negation must NOT distribute; real M7
 * disclaimer lists coordinate their final item with `or`/`nor`.
 */
declare const LIST_COORDINATORS: readonly string[];
/**
 * The canonical M7 vocabulary. 10 prohibited tokens/phrases + the `AI` identity
 * rule = 11 rows, verbatim from the spec's reconciled seed table.
 */
declare const COMPLIANCE_REGISTRY: readonly ComplianceEntry[];
/**
 * Frozen membership set of canonical token identities (runtime guard +
 * edit-distance hints). Mirrors the Guard-Kit `CANONICAL_X_SET` primitive.
 */
declare const COMPLIANCE_TOKEN_SET: ReadonlySet<string>;
/** SOT enumeration primitive — the canonical "all prohibited tokens" list. */
declare function listComplianceEntries(): readonly ComplianceEntry[];

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

interface CheckOptions {
    /** Char ranges `[startInclusive, endExclusive]` the caller marked as an
     *  illustrative/disclaimer block. A token whose offset falls inside one of
     *  these ranges is allowed IFF its entry declares a `disclaimer-banner`
     *  context. Fail-safe-strict: an unmarked banner still HARD_BLOCKs. */
    readonly disclaimerRanges?: ReadonlyArray<readonly [number, number]>;
    /** Restrict the returned violations to these categories. Default: both. */
    readonly categories?: readonly ComplianceCategory[];
}
interface Violation {
    readonly token: string;
    readonly category: ComplianceCategory;
    /** Char offset of the match in the ORIGINAL input text. */
    readonly index: number;
    readonly matchedText: string;
    readonly suggest?: string;
    /** Actionable, parameterized failure message (Guard-Kit §6 form). */
    readonly message: string;
}
/**
 * Scan `text` for M7 prohibited language. Returns the violations that are NOT
 * excused by an allowed context. Empty/non-string input returns `[]` (no throw).
 */
declare function checkCompliance(text: string, opts?: CheckOptions): readonly Violation[];
/** True iff `text` contains at least one HARD_BLOCK violation. */
declare function hasHardBlock(text: string, opts?: CheckOptions): boolean;

export { type AllowedContext, CLAUSE_BREAKERS, COMPLIANCE_REGISTRY, COMPLIANCE_TOKEN_SET, type CheckOptions, type ComplianceCategory, type ComplianceEntry, DEFAULT_LIST_NEGATION_PROXIMITY, DEFAULT_NEGATION_PROXIMITY, LIST_COORDINATORS, type MatchType, NEGATION_CUES, type Violation, checkCompliance, hasHardBlock, listComplianceEntries };
