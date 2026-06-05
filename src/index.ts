/**
 * @rello-platform/compliance-words — public surface.
 *
 * The canonical machine source-of-truth for the M7 borrower-facing
 * prohibited-language rule. Consumers import the registry (the vocabulary +
 * context model) and the `checkCompliance`/`hasHardBlock` checker; the committed
 * `dist/compliance-words-keyset.json` carries the same vocabulary + context rules
 * for the Python Report-Engine consumer (single SoT, two languages).
 *
 * Build phase 1 (this package) GATES the downstream consumer gates
 * (NS send · Report-Engine publish · Rello HECM publish · Milo generation) — they
 * pin a tag of this package; none re-implements the vocabulary.
 */

export {
  COMPLIANCE_REGISTRY,
  COMPLIANCE_TOKEN_SET,
  NEGATION_CUES,
  DEFAULT_NEGATION_PROXIMITY,
  DEFAULT_LIST_NEGATION_PROXIMITY,
  CLAUSE_BREAKERS,
  LIST_COORDINATORS,
  listComplianceEntries,
  type ComplianceCategory,
  type MatchType,
  type AllowedContext,
  type ComplianceEntry,
} from "./registry/index.js";

export {
  checkCompliance,
  hasHardBlock,
  type CheckOptions,
  type Violation,
} from "./check.js";

// ── Role-aware lane checker (DRAFT — warn-only, off by default) ───────────────
// Flags cross-lane language (an agent speaking as an MLO, or vice versa) in
// nurture copy. Defaults to WARNING; no M7 gate calls it until Kelly approves.
export {
  LANE_REGISTRY,
  LANE_TOKEN_SET,
  listLaneEntries,
  type Lane,
  type LaneSeverity,
  type LaneEntry,
} from "./lanes/index.js";

export {
  scanLaneViolations,
  hasLaneViolation,
  type Role,
  type ScanLaneOptions,
  type LaneViolation,
} from "./lanes/scan.js";

// ── Reg-Z + UDAAP rate-claim checker (DRAFT — warn-only, off by default) ──────
// Numeric/comparison-aware scanner that the phrase matcher cannot express:
// flags a stated mortgage-rate FIGURE without a nearby APR (Reg Z §1026.24) and
// an unsubstantiated rate self-comparison ("below market", "lowest rate", "40
// bps below") (CFPB UDAAP). Defaults to WARNING; no gate calls it until Kelly
// approves arming. Mirrors Milo's detectsRateFigure rate-vs-value distinction.
export {
  scanRateClaims,
  hasRateClaimViolation,
  RATE_CLAIM_CONFIG,
  type RateClaimToken,
  type RateClaimSeverity,
  type RateClaimOptions,
  type RateClaimViolation,
} from "./rate-claims/scan.js";
