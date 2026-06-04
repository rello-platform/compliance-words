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

import type { AllowedContext, MatchType } from "../registry/index.js";

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
export type Lane = "AGENT_LANE_VIOLATION" | "MLO_LANE_VIOLATION";

/**
 * Severity of a lane finding. DEFAULTS to `WARNING` platform-wide for the lane
 * checker (draft posture — surface for human review, do not block) until Kelly
 * approves arming. `REVIEW_FLAG` mirrors the M7 "warn line" tier; reserved for
 * borderline rows we want surfaced even more softly. No lane row is `HARD_BLOCK`
 * in this draft.
 */
export type LaneSeverity = "HARD_BLOCK" | "WARNING" | "REVIEW_FLAG";

export interface LaneEntry {
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

// ── Shared allowed-context primitives (mirror the M7 NEGATION/DISCLAIMER) ─────

const NEGATION: AllowedContext = {
  kind: "negation",
  pattern: "negation cue (not|never|no|isn't|won't…) within proximity words before the match, same clause",
  note: "A negated / NOT-THAT use is in-lane meta-copy, not a cross-lane act. E.g. an agent writing 'I am not your loan officer and cannot lock your rate — talk to your MLO' names the wrong-lane phrase only to disclaim it. Same affirmative-vs-NOT-THAT rule as M7.",
};

const DISCLAIMER: AllowedContext = {
  kind: "disclaimer-banner",
  pattern: "match offset within a caller-supplied disclaimerRanges block",
  note: "An explicitly-marked educational/referral disclaimer block (e.g. 'For loan questions, your loan officer can help you apply for a loan and lock your rate.') legitimately names the other lane's actions when steering the recipient TO that professional. The caller marks the range; fail-safe-strict if it does not.",
};

/**
 * The role-aware lane vocabulary. Every row is a wrong-lane OFFER / SOLICITATION
 * / ADVICE collocation — never a bare topical noun — so ordinary market context
 * passes. Draft: all rows are WARNING.
 */
export const LANE_REGISTRY: readonly LaneEntry[] = [
  // ════════════════════════════════════════════════════════════════════════
  // AGENT_LANE_VIOLATION — MLO-only language an AGENT must not use.
  // ════════════════════════════════════════════════════════════════════════
  {
    token: "rate offer",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    // A possessive/offer-framed rate QUOTE. The framing word ("your"/"a special"/
    // "we can offer you"/"I can get you"/"lock in") is REQUIRED so a bare market-
    // rate statement is not caught (see rationale).
    forms: [
      "your rate will be",
      "your rate is",
      "your interest rate will be",
      "your interest rate is",
      "we can offer you a rate",
      "we can offer you a rate of",
      "i can offer you a rate",
      "i can get you a rate",
      "we'll give you a rate",
      "i'll give you a rate",
      "a special rate of",
      "an exclusive rate of",
      "your rate would be",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Quoting a SPECIFIC interest rate as a personal offer is loan origination — an MLO act under the SAFE Act. Forbidden for an agent. DELIBERATELY NOT CAUGHT (false-positive guards): general market context an agent may freely cite — 'today's 30-year rates are around 6% per Freddie Mac', 'rates have come down', 'when rates drop you may want to refinance', 'ask your loan officer about current rates'. Only the possessive/first-person OFFER framing ('your rate is…', 'we can offer you a rate of…') trips this row.",
    suggest: "refer the recipient to their loan officer for any rate quote",
  },
  {
    token: "you qualify for",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "you qualify for a rate",
      "you qualify for a rate of",
      "you qualify for a loan",
      "you qualify for a mortgage",
      "you qualify for financing",
      "you qualify for a loan amount",
      "you qualify for up to",
      "you qualify for a lower rate",
      "you'll qualify for a loan",
      "you may qualify for a loan",
      "you may qualify for a mortgage",
      "you pre-qualify for a loan",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Telling a consumer they 'qualify for' a loan / a rate / a loan amount is a credit-eligibility determination — an MLO act. Forbidden for an agent. DELIBERATELY NOT CAUGHT: non-loan eligibility an agent legitimately discusses — 'you qualify for a property-tax exemption', 'homes that qualify for this program', 'you qualify for our VIP buyer list'. Only loan/mortgage/rate/financing qualification framing trips this row.",
    suggest: "refer the recipient to their loan officer to discuss loan eligibility",
  },
  {
    token: "approved for a loan",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "you're approved for a loan",
      "you are approved for a loan",
      "you're approved for a mortgage",
      "you are approved for a mortgage",
      "you're pre-approved",
      "you are pre-approved",
      "you're pre-approved for a loan",
      "you are pre-approved for a loan",
      "you're pre-approved for a mortgage",
      "you are pre-approved for a mortgage",
      "i can get you approved",
      "we can get you approved",
      "you've been approved for financing",
      "you have been approved for financing",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Stating that a consumer is 'approved' or 'pre-approved' for a loan/mortgage is a credit decision — an MLO/lender act. Forbidden for an agent. (Note: M7 also blocks bare borrower-facing 'approved' claims; this lane row is the role-scoped, MLO-only sense — distinct gate.) DELIBERATELY NOT CAUGHT: non-loan approvals an agent handles — 'your offer was approved by the seller', 'the HOA approved your application', 'HUD-approved counselor' (M7 compound). Only loan/mortgage/financing pre-approval framing trips this row.",
    suggest: "refer the recipient to their loan officer for any pre-approval",
  },
  {
    token: "lock your rate",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "lock your rate",
      "lock in your rate",
      "lock your interest rate",
      "lock in your interest rate",
      "let's lock your rate",
      "we can lock your rate",
      "i can lock your rate",
      "lock your rate today",
      "lock in a low rate",
      "lock in a great rate",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Offering to lock a borrower's interest rate is a loan-origination act controlled by the lender/MLO. Forbidden for an agent. (M7 also blocks the bare borrower-facing 'lock' claim; this is the role-scoped sense.) DELIBERATELY NOT CAUGHT: unrelated 'lock' uses — 'lock the front door at a showing', 'lock box code', 'price lock' on a new-construction contract (an agent matter). Only the rate-lock OFFER collocation trips this row.",
    suggest: "your loan officer handles rate locks — refer the recipient to them",
  },
  {
    token: "refinance with me",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "refinance with me",
      "refinance with us",
      "i can refinance you",
      "we can refinance you",
      "i can refinance your",
      "we can refinance your",
      "let me refinance",
      "let us refinance",
      "refinance your loan with me",
      "refinance your mortgage with me",
      "refinance your loan with us",
      "refinance your mortgage with us",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Soliciting a refinance as the originator ('refinance with me') is an MLO act. Forbidden for an agent. DELIBERATELY NOT CAUGHT: educational refi talk an agent may write — 'refinancing can lower your payment', 'when rates drop, refinancing may make sense', 'ask your loan officer about a refinance'. Only the first-person ORIGINATOR solicitation ('refinance with me/us', 'I can refinance you') trips this row.",
    suggest: "talk to your loan officer about refinancing options",
  },
  {
    token: "apply for a loan with me",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "apply for a loan with me",
      "apply for a loan with us",
      "apply for a mortgage with me",
      "apply for a mortgage with us",
      "apply for your loan with me",
      "apply for your mortgage with me",
      "start your loan application with me",
      "start your loan application with us",
      "start your mortgage application with me",
      "complete your loan application with me",
      "i can take your loan application",
      "we can take your loan application",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Taking a loan/mortgage application is the defining MLO act under the SAFE Act. Forbidden for an agent. DELIBERATELY NOT CAUGHT: an agent steering the borrower TO the MLO — 'apply for a loan with your loan officer', 'your lender can help you apply' (and the explicit referral-disclaimer-banner allowance). Only the first-person 'with me/us' origination collocation trips this row, so a bare educational 'you'll need to apply for a loan' is not flagged.",
    suggest: "your loan officer takes loan applications — refer the recipient to them",
  },
  {
    token: "recommend a loan product",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "i recommend an fha loan",
      "i recommend a va loan",
      "i recommend a usda loan",
      "i recommend a conventional loan",
      "i recommend a jumbo loan",
      "i recommend an arm",
      "i recommend a heloc",
      "i recommend a home equity loan",
      "i recommend a reverse mortgage",
      "you should get an fha loan",
      "you should get a va loan",
      "you should get a conventional loan",
      "you should get a heloc",
      "you should get an arm",
      "the right loan for you is",
      "the best loan for you is",
      "i'd recommend a fixed-rate mortgage",
      "i recommend a fixed-rate mortgage",
      "i recommend an adjustable-rate mortgage",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Recommending a SPECIFIC loan product/program to a consumer is loan advice reserved to an MLO. Forbidden for an agent. DELIBERATELY NOT CAUGHT: an agent NAMING loan types educationally without recommending one — 'FHA, VA, and conventional loans are all options your loan officer can explain', 'ask your lender which program fits'. Only the first-person RECOMMENDATION collocation ('I recommend a …', 'you should get a …', 'the right loan for you is …') trips this row.",
    suggest: "your loan officer advises on loan products — refer the recipient to them",
  },
  {
    token: "apr trigger term",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    // Reg Z (12 CFR §1026.24) trigger terms: an APR figure or a specific monthly-
    // payment figure stated as a consumer-credit OFFER. The numeric token is
    // matched by a phrase 'apr' / 'a.p.r.' collocation. A bare APR figure in a
    // disclosure (or an agent quoting "the APR was disclosed at closing") is
    // out-of-scope; the framing words ('your'/'only'/'as low as'/'just') carry the
    // offer sense.
    // NOTE on matching: the shared phrase matcher requires the form's words to be
    // adjacent (separated only by non-word chars), so a form like "only … per
    // month" with a NUMBER between would NOT match (the digits are word chars).
    // We therefore key on adjacent-word offer collocations only ("your apr will
    // be", "rates as low as", "payment as low as"), and DOCUMENT that strict
    // numeric APR/payment detection is the consumer's own Reg-Z scan (see note).
    forms: [
      "your apr will be",
      "your apr is",
      "your a.p.r. will be",
      "your monthly payment will be",
      "your monthly payment is",
      "your estimated monthly payment will be",
      "your estimated payment will be",
      "rates as low as",
      "rate as low as",
      "apr as low as",
      "payments as low as",
      "payment as low as",
      "monthly payments as low as",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Reg Z (TILA, 12 CFR §1026.24) governs consumer-credit advertising 'trigger terms' — a stated APR or specific monthly payment as an OFFER pulls in mandatory disclosures only a lender/MLO can make. Forbidden for an agent. DELIBERATELY NOT CAUGHT: general payment math an agent may show generically — 'a rough rule of thumb is principal-and-interest of about $X per $100k' framed as illustration, or APR named in a marked disclaimer block. Only the possessive ('your APR/payment will be') and 'as low as' OFFER framing trips this row. IMPORTANT LIMITATION: this row keys on offer-framing collocations, NOT on parsing a numeric percentage or dollar figure (the shared phrase matcher cannot span a number) — a downstream consumer that wants strict numeric APR/payment trigger-term detection MUST pair this with its own Reg-Z numeric scan.",
    suggest: "loan pricing/APR comes from the loan officer — omit or refer",
  },

  // ════════════════════════════════════════════════════════════════════════
  // MLO_LANE_VIOLATION — agent-only language an MLO must not use.
  // ════════════════════════════════════════════════════════════════════════
  {
    token: "list your home with me",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "list your home with me",
      "list your home with us",
      "list your house with me",
      "list your house with us",
      "list your property with me",
      "list your property with us",
      "list with me",
      "list with us",
      "i can list your home",
      "we can list your home",
      "i'll list your home",
      "let me list your home",
      "ready to list your home",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Soliciting a listing ('list your home with me') is brokerage activity requiring a real-estate license — forbidden for an MLO. DELIBERATELY NOT CAUGHT: ordinary 'list' uses an MLO may write — 'a checklist for closing', 'the list of documents we need', 'your listing agent can help' (steering to the agent). Only the first-person listing SOLICITATION collocation trips this row.",
    suggest: "refer the recipient to their real-estate agent to list a home",
  },
  {
    token: "i'll sell your home",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "i'll sell your home",
      "i will sell your home",
      "i can sell your home",
      "we'll sell your home",
      "we will sell your home",
      "we can sell your home",
      "i'll sell your house",
      "i can sell your house",
      "let me sell your home",
      "let me sell your house",
      "sell your home for you",
      "sell your house for you",
      "i'll get your home sold",
      "i can get your home sold",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Offering to sell a consumer's home is brokerage activity — forbidden for an MLO. DELIBERATELY NOT CAUGHT: market-education an MLO may write — 'homes are selling quickly in your area', 'when you sell your home, the proceeds can pay off your loan', 'your agent can help you sell'. Only the first-person OFFER-TO-SELL collocation ('I'll/I can sell your home', 'sell your home for you') trips this row.",
    suggest: "refer the recipient to their real-estate agent to sell a home",
  },
  {
    token: "i'm your real estate agent",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "i'm your real estate agent",
      "i am your real estate agent",
      "i'm your realtor",
      "i am your realtor",
      "as your real estate agent",
      "as your realtor",
      "as your listing agent",
      "as your buyer's agent",
      "i'm your listing agent",
      "i am your listing agent",
      "i'll be your real estate agent",
      "i will be your real estate agent",
      "i'm your agent",
      "i am your agent",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Claiming to be the consumer's real-estate agent / Realtor / listing agent is holding oneself out as licensed brokerage — forbidden for an MLO. DELIBERATELY NOT CAUGHT: an MLO naming the OTHER professional — 'your real estate agent can help with that', 'work with your agent on the offer', 'I'm your loan officer, not your agent' (negation). Only the FIRST-PERSON identity claim ('I'm/I am/as your … agent/Realtor') trips this row. Edge: bare 'I'm your agent' is included because in an MLO-authored email it is a cross-lane identity claim; an MLO who means 'loan agent' should write 'loan officer'.",
    suggest: "identify yourself as the loan officer; name the agent as a separate professional",
  },
  {
    token: "let me show you homes",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "let me show you homes",
      "let me show you houses",
      "let me show you some homes",
      "let me show you properties",
      "i can show you homes",
      "i can show you houses",
      "we can show you homes",
      "i'll show you homes",
      "i'll show you houses",
      "schedule a showing with me",
      "schedule a showing with us",
      "book a showing with me",
      "i can schedule a showing",
      "let's tour some homes",
      "i can take you to see homes",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Offering to show homes / schedule showings is brokerage activity — forbidden for an MLO. DELIBERATELY NOT CAUGHT: education an MLO may write — 'when you're ready to see homes, your agent can set up showings', 'open houses are a great way to see homes'. Only the first-person OFFER-TO-SHOW collocation ('let me/I can show you homes', 'schedule a showing with me') trips this row.",
    suggest: "refer the recipient to their real-estate agent for showings",
  },
  {
    token: "my listings",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    // The PLURAL "my listings" is unambiguously real-estate inventory. The bare
    // SINGULAR "my listing" is NOT a form here — it collides with the ordinary
    // sense "my listing of the documents" (a list of items). The property sense
    // of the singular is carried by explicit collocations ("my new listing", "my
    // listing agreement", "my just-listed home").
    forms: [
      "my listings",
      "my latest listings",
      "my new listings",
      "my featured listings",
      "my current listings",
      "check out my listings",
      "view my listings",
      "see my listings",
      "browse my listings",
      "my just-listed homes",
      "my just-listed home",
      "my new listing",
      "my latest listing",
      "my featured listing",
      "my listing agreement",
      "homes i have listed",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Advertising 'my listings' represents the sender as the listing broker — forbidden for an MLO. DELIBERATELY NOT CAUGHT: non-real-estate 'listing' uses — the bare singular 'my listing of required documents' (a list of items; the bare singular 'my listing' is intentionally NOT a form), 'the listings on the MLS' (no possessive), 'your agent's listings'. Only the FIRST-PERSON POSSESSIVE PLURAL 'my listings' and unambiguous property collocations ('my new listing', 'my listing agreement', 'my just-listed home') trip this row.",
    suggest: "do not advertise property listings; refer the recipient to their agent",
  },
  {
    token: "free cma to list",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    // A CMA (comparative market analysis) presented as a LISTING SOLICITATION.
    // A bare "comparative market analysis" mention is NOT caught — an MLO may
    // reference that a CMA exists; the solicitation framing is what crosses lanes.
    forms: [
      "free cma",
      "free comparative market analysis",
      "get your free cma",
      "request your free cma",
      "free home valuation to list",
      "what's your home worth list",
      "i'll prepare a cma to list",
      "i can prepare a cma",
      "let me prepare a cma",
      "i'll run a cma for you",
      "free market analysis to sell your home",
      "complimentary cma",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Offering a free CMA / home valuation as a listing-solicitation hook is a brokerage prospecting act — forbidden for an MLO. DELIBERATELY NOT CAUGHT: an MLO referencing a CMA neutrally — 'your agent can prepare a comparative market analysis (CMA)', 'a CMA estimates market value'. Only the SOLICITATION framing ('free CMA', 'request your free CMA', 'I'll prepare a CMA to list') trips this row. NOTE: the bare phrase 'comparative market analysis' (educational) is intentionally NOT a form here — only the 'free'/'I'll prepare'/'to list' solicitation collocations are.",
    suggest: "refer the recipient to their agent for a CMA or home valuation",
  },
  {
    token: "represent you in the purchase or sale",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "represent you in the purchase",
      "represent you in the sale",
      "represent you in the purchase or sale",
      "represent you in buying",
      "represent you in selling",
      "represent you as your agent",
      "i can represent you in the purchase",
      "i can represent you in the sale",
      "i'll represent you in the purchase",
      "i'll represent you in the sale",
      "let me represent you in the purchase",
      "let me represent you in the sale",
      "represent you in your home purchase",
      "represent you in your home sale",
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION, DISCLAIMER],
    rationale:
      "Offering to 'represent' a consumer in a real-estate purchase or sale is agency/brokerage representation — forbidden for an MLO. DELIBERATELY NOT CAUGHT: an MLO describing loan-side representation/help — 'represent your loan file to the underwriter' (not a real-estate-agency act), 'your agent represents you in the purchase' (naming the other professional). Only the first-person 'represent you in the purchase/sale/buying/selling' collocation trips this row.",
    suggest: "the real-estate agent represents the buyer/seller — refer the recipient to them",
  },
];

/** Frozen membership set of lane-row token identities (runtime guard). */
export const LANE_TOKEN_SET: ReadonlySet<string> = new Set(
  LANE_REGISTRY.map((e) => e.token),
);

/** All lane rows that forbid the given lane (i.e. that a given role must avoid). */
export function listLaneEntries(lane?: Lane): readonly LaneEntry[] {
  return lane ? LANE_REGISTRY.filter((e) => e.lane === lane) : LANE_REGISTRY;
}
