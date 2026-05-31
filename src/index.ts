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
