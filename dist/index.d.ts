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

/**
 * @rello-platform/compliance-words — the role-aware LANE registry (DRAFT).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * STATUS: DRAFT for Kelly's review. Defaults to WARNING severity (NOT
 * HARD_BLOCK) and is gated OFF by default in the scanner (`scanLaneViolations`
 * applies it; no existing M7 gate calls it). Do NOT arm hard-blocking until
 * Kelly approves the per-lane banned-phrase list (see README § Lane checker).
 * ───────────────────────────────────────────────────────────────────────────
 *
 * WHAT THIS IS. A nurture email is sent on behalf of EITHER a real-estate AGENT
 * (state RE license) OR a mortgage loan officer (MLO — NMLS / SAFE Act).
 * Regulators object when one acts in the other's lane ("stay in your lane"): an
 * agent must not originate/quote/approve a loan; an MLO must not solicit a
 * listing or act as the buyer's/seller's agent. This registry flags CROSS-LANE
 * language so a downstream gate can warn (and, once Kelly approves, block) before
 * the copy goes out.
 *
 * SAME ARCHITECTURE AS M7. Each lane row is a `LaneEntry` that reuses the exact
 * `ComplianceEntry` matching model — `matchType` (`word-stem`/`phrase`/`word`),
 * explicit `forms`, and the `allowedContexts` excusal model (negation / compound
 * / disclaimer-banner). It runs over the SAME shared match engine
 * (`src/match-engine.ts`) as `checkCompliance`, so the two checkers can never
 * drift, and the Python re-implementation mirrors one algorithm. The ONLY new
 * fields are `lane` (which role the phrase is forbidden FOR) and a default
 * `severity`.
 *
 * THE CONSERVATIVE-AGAINST-FALSE-POSITIVES BAR (the load-bearing design choice).
 * General market context is NOT a lane violation. "30-year rates are around 6%
 * per Freddie Mac", "rates have come down lately", "list price", "the homes on
 * the market", "a comparative market analysis is a useful tool" — these are
 * ordinary, in-lane, educational copy that BOTH roles may write. Only an OFFER,
 * a SOLICITATION, or in-lane ADVICE in the WRONG lane is flagged. We achieve this
 * the same way M7's Gap-2 narrowed bare `offer` to its promotional collocations:
 * every lane row matches a PHRASE collocation that carries the offer/solicitation
 * framing (a possessive "your", a first-person "I/we ... you", an imperative
 * "apply/list/lock"), never a bare topical noun. Edge cases are documented inline
 * per row.
 *
 * NOT borrower-vs-not — role-vs-role. M7 asks "is this borrower-facing copy a
 * prohibited claim?"; the lane check asks "does this copy speak in the other
 * profession's voice?". The two are orthogonal and composable: a string can be
 * M7-clean yet cross-lane ("I'll sell your home" — no M7 token, but an MLO must
 * not say it), or both. A consumer runs whichever gates apply to the surface.
 */

/**
 * Which professional lane a phrase BELONGS to — i.e. which role is FORBIDDEN
 * from using it.
 * - `AGENT_LANE_VIOLATION`: language only an MLO may use → FORBIDDEN for an
 *   AGENT (rate offers, "you qualify for X%", loan approvals, "lock your rate",
 *   "apply for a loan", recommending loan products, APR/payment trigger terms).
 * - `MLO_LANE_VIOLATION`: language only an agent may use → FORBIDDEN for an MLO
 *   ("list your home with me", "I'll sell your home", "I'm your agent", "let me
 *   show you homes", "my listings", CMA-as-listing-solicitation, "represent you
 *   in the purchase/sale").
 */
type Lane = "AGENT_LANE_VIOLATION" | "MLO_LANE_VIOLATION";
/**
 * Severity of a lane finding. DEFAULTS to `WARNING` platform-wide for the lane
 * checker (draft posture — surface for human review, do not block) until Kelly
 * approves arming. `REVIEW_FLAG` mirrors the M7 "warn line" tier; reserved for
 * borderline rows we want surfaced even more softly. No lane row is `HARD_BLOCK`
 * in this draft.
 */
type LaneSeverity = "HARD_BLOCK" | "WARNING" | "REVIEW_FLAG";
interface LaneEntry {
    /** Canonical lowercase identity of the row (the lane "token"). */
    readonly token: string;
    /** Which role is forbidden from this language. */
    readonly lane: Lane;
    readonly matchType: MatchType;
    /** Explicit surface forms — phrase collocations that carry the wrong-lane
     *  offer/solicitation framing (NOT bare topical nouns). */
    readonly forms: readonly string[];
    /** Default severity for this row (draft: WARNING). The scanner lets a caller
     *  override the floor; the SoT keeps the conservative draft default here. */
    readonly severity: LaneSeverity;
    /** Same excusal model as M7 — negation / compound / disclaimer-banner. */
    readonly allowedContexts: readonly AllowedContext[];
    /** Plain-language description of WHY this is cross-lane + the false-positive
     *  edge cases it deliberately does NOT catch. Surfaced verbatim in the README
     *  so Kelly can approve line by line. */
    readonly rationale: string;
    /** Compliant in-lane substitution suggested in the finding message. */
    readonly suggest?: string;
}
/**
 * The role-aware lane vocabulary. Every row is a wrong-lane OFFER / SOLICITATION
 * / ADVICE collocation — never a bare topical noun — so ordinary market context
 * passes. Draft: all rows are WARNING.
 */
declare const LANE_REGISTRY: readonly LaneEntry[];
/** Frozen membership set of lane-row token identities (runtime guard). */
declare const LANE_TOKEN_SET: ReadonlySet<string>;
/** All lane rows that forbid the given lane (i.e. that a given role must avoid). */
declare function listLaneEntries(lane?: Lane): readonly LaneEntry[];

/**
 * `scanLaneViolations(text, role)` — the role-aware cross-lane checker (DRAFT).
 *
 * Runs the LANE_REGISTRY over the SAME shared match engine
 * (`src/match-engine.ts`) as the M7 `checkCompliance`, then keeps only the rows
 * that are out-of-lane for the caller's `role`:
 *   - role "AGENT" → return AGENT_LANE_VIOLATION rows (MLO-only language).
 *   - role "MLO"   → return MLO_LANE_VIOLATION rows (agent-only language).
 *   - role "DUAL"  → see the documented DUAL decision below.
 *
 * DRAFT POSTURE. Severity defaults to the per-row `severity` (every row is
 * WARNING in this draft). The scanner NEVER promotes a row to HARD_BLOCK on its
 * own; a caller may pass `severityFloor` to RAISE the reported severity once
 * Kelly approves arming, but the SoT default is warn-only. No existing M7 gate
 * calls this function, so wiring it in is an explicit, opt-in step.
 *
 * Returns `{ token, message, severity }` per the dispatch contract, plus the
 * match offset / matchedText / lane / suggest for actionable consumers.
 *
 * Pure function over text; no I/O, no throw on bad input.
 */

/** The professional on whose behalf the copy is sent. */
type Role = "AGENT" | "MLO" | "DUAL";
interface ScanLaneOptions {
    /** Char ranges the caller marked as an educational/referral disclaimer block.
     *  A lane match inside one of these is allowed IFF its row declares a
     *  `disclaimer-banner` context (all rows do). Fail-safe-strict otherwise. */
    readonly disclaimerRanges?: ReadonlyArray<readonly [number, number]>;
    /** Raise the reported severity to at least this floor (e.g. pass "HARD_BLOCK"
     *  ONLY after Kelly approves arming). Default: undefined → each row reports its
     *  own draft `severity` (WARNING). The floor can only RAISE, never lower. */
    readonly severityFloor?: LaneSeverity;
}
interface LaneViolation {
    readonly token: string;
    readonly lane: Lane;
    /** Effective severity after applying `severityFloor` (draft default: WARNING). */
    readonly severity: LaneSeverity;
    /** Char offset of the match in the ORIGINAL input text. */
    readonly index: number;
    readonly matchedText: string;
    readonly suggest?: string;
    /** Actionable, parameterized message (mirrors the M7 Violation message form). */
    readonly message: string;
}
/**
 * Scan `text` for cross-lane language the sender's `role` may not use.
 * Empty/non-string input returns `[]` (no throw). DUAL returns `[]` (see
 * {@link lanesForRole}).
 */
declare function scanLaneViolations(text: string, role: Role, opts?: ScanLaneOptions): readonly LaneViolation[];
/**
 * True iff `text` contains at least one lane violation for `role`. Convenience
 * mirror of `hasHardBlock`. Draft posture: this reports the PRESENCE of a
 * (warn-level) lane issue — it does NOT block by itself; the consumer decides.
 */
declare function hasLaneViolation(text: string, role: Role, opts?: ScanLaneOptions): boolean;

export { type AllowedContext, CLAUSE_BREAKERS, COMPLIANCE_REGISTRY, COMPLIANCE_TOKEN_SET, type CheckOptions, type ComplianceCategory, type ComplianceEntry, DEFAULT_LIST_NEGATION_PROXIMITY, DEFAULT_NEGATION_PROXIMITY, LANE_REGISTRY, LANE_TOKEN_SET, LIST_COORDINATORS, type Lane, type LaneEntry, type LaneSeverity, type LaneViolation, type MatchType, NEGATION_CUES, type Role, type ScanLaneOptions, type Violation, checkCompliance, hasHardBlock, hasLaneViolation, listComplianceEntries, listLaneEntries, scanLaneViolations };
