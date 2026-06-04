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

import {
  LANE_REGISTRY,
  type Lane,
  type LaneEntry,
  type LaneSeverity,
} from "./index.js";
import {
  compileMatcher,
  maskHtml,
  indexWords,
  runMatcher,
  type CompiledMatcher,
} from "../match-engine.js";

/** The professional on whose behalf the copy is sent. */
export type Role = "AGENT" | "MLO" | "DUAL";

export interface ScanLaneOptions {
  /** Char ranges the caller marked as an educational/referral disclaimer block.
   *  A lane match inside one of these is allowed IFF its row declares a
   *  `disclaimer-banner` context (all rows do). Fail-safe-strict otherwise. */
  readonly disclaimerRanges?: ReadonlyArray<readonly [number, number]>;
  /** Raise the reported severity to at least this floor (e.g. pass "HARD_BLOCK"
   *  ONLY after Kelly approves arming). Default: undefined → each row reports its
   *  own draft `severity` (WARNING). The floor can only RAISE, never lower. */
  readonly severityFloor?: LaneSeverity;
}

export interface LaneViolation {
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

interface CompiledLane {
  readonly entry: LaneEntry;
  readonly matcher: CompiledMatcher;
}

const COMPILED: readonly CompiledLane[] = LANE_REGISTRY.map((entry) => ({
  entry,
  matcher: compileMatcher(entry),
}));

/** Ordered severity ranking so `severityFloor` can only raise. */
const SEVERITY_RANK: Record<LaneSeverity, number> = {
  REVIEW_FLAG: 0,
  WARNING: 1,
  HARD_BLOCK: 2,
};

function applyFloor(rowSeverity: LaneSeverity, floor: LaneSeverity | undefined): LaneSeverity {
  if (!floor) return rowSeverity;
  return SEVERITY_RANK[floor] > SEVERITY_RANK[rowSeverity] ? floor : rowSeverity;
}

/**
 * Which lanes a role must AVOID.
 *
 * DUAL-ROLE DECISION (documented). A genuinely dual-licensed sender (holds BOTH
 * a state RE license AND an active NMLS/MLO registration) may lawfully speak in
 * either lane — there is no cross-lane violation to flag, because neither lane is
 * "wrong" for them. So `role: "DUAL"` SKIPS lane checks (returns `[]`). This is
 * the conservative-against-false-positives choice: applying both lanes to a DUAL
 * sender would flag every legitimate sentence they write. The trade-off — a
 * dual-licensee can still write copy that fails OTHER rules (RESPA conflict-of-
 * interest disclosure, M7 borrower-facing claims) — is out of scope for the
 * lane check and handled by the M7 `checkCompliance` gate, which a consumer runs
 * independently regardless of role. Consumers should default a sender to their
 * SINGLE license (AGENT or MLO) and use DUAL only when dual licensure is
 * verified, so the safe default keeps lane enforcement ON.
 */
function lanesForRole(role: Role): readonly Lane[] {
  switch (role) {
    case "AGENT":
      return ["AGENT_LANE_VIOLATION"];
    case "MLO":
      return ["MLO_LANE_VIOLATION"];
    case "DUAL":
      return [];
    default:
      // Fail-safe-strict: an unknown role is treated as the strictest posture —
      // both lanes apply — rather than silently skipping enforcement.
      return ["AGENT_LANE_VIOLATION", "MLO_LANE_VIOLATION"];
  }
}

function buildMessage(entry: LaneEntry, matchedText: string, index: number, severity: LaneSeverity): string {
  const laneLabel =
    entry.lane === "AGENT_LANE_VIOLATION"
      ? "MLO-only language in an agent's copy"
      : "agent-only language in an MLO's copy";
  const base = `⚠ ${severity} [lane]: "${matchedText}" is ${laneLabel} ("${entry.token}") at offset ${index}`;
  return entry.suggest ? `${base} → ${entry.suggest}` : base;
}

/**
 * Scan `text` for cross-lane language the sender's `role` may not use.
 * Empty/non-string input returns `[]` (no throw). DUAL returns `[]` (see
 * {@link lanesForRole}).
 */
export function scanLaneViolations(
  text: string,
  role: Role,
  opts: ScanLaneOptions = {},
): readonly LaneViolation[] {
  if (typeof text !== "string" || text.length === 0) return [];

  const applicable = new Set(lanesForRole(role));
  if (applicable.size === 0) return [];

  const masked = maskHtml(text);
  const words = indexWords(masked);
  const violations: LaneViolation[] = [];

  for (const { entry, matcher } of COMPILED) {
    if (!applicable.has(entry.lane)) continue;
    for (const { index, matchedText } of runMatcher(matcher, text, masked, words, opts.disclaimerRanges)) {
      const severity = applyFloor(entry.severity, opts.severityFloor);
      violations.push({
        token: entry.token,
        lane: entry.lane,
        severity,
        index,
        matchedText,
        suggest: entry.suggest,
        message: buildMessage(entry, matchedText, index, severity),
      });
    }
  }

  violations.sort((a, b) => a.index - b.index || a.token.localeCompare(b.token));
  return violations;
}

/**
 * True iff `text` contains at least one lane violation for `role`. Convenience
 * mirror of `hasHardBlock`. Draft posture: this reports the PRESENCE of a
 * (warn-level) lane issue — it does NOT block by itself; the consumer decides.
 */
export function hasLaneViolation(text: string, role: Role, opts: ScanLaneOptions = {}): boolean {
  return scanLaneViolations(text, role, opts).length > 0;
}
