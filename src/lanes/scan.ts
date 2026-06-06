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
 * OWN-RATE ESCAPE (v0.5.0, Kelly ruling 2026-06-03). The AGENT `rate offer` row
 * carries an `own-rate` allowed-context: a possessive "your rate is …" match is
 * EXCUSED when the surrounding window references the lead's OWN existing rate
 * (`OWN_RATE_CUES`) with no prospective-offer framing (`OFFER_CUES`) — "your
 * current rate is 2.88%", "your rate is still one of the best", "you're sitting on
 * a 2.94% rate", "your 6.5% rate alert" no longer false-flag as MLO-lane rate
 * offers. A real offer STILL flags ("your rate will be 5.5%", "your new rate could
 * be 5.5%", "I can offer you a rate of …"). This REUSES the exact OWN_RATE_CUES /
 * OFFER_CUES regexes from `../rate-claims/scan.ts` (single source of truth), so
 * the lane checker and the rate-claims checker agree on what "the lead's own rate"
 * means. Only the `rate offer` row is affected; all other lane rows are unchanged.
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
import {
  OWN_RATE_CUES,
  OFFER_CUES,
  OWN_RATE_WINDOW,
} from "../rate-claims/scan.js";

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
  /** v0.5.0: does this row carry the `own-rate` allowed-context? The shared match
   *  engine only knows negation/compound/disclaimer; the lane-only own-rate escape
   *  is applied here (mirrors the rate-claims scanRegZ lead-owned-rate carve-out
   *  with the SAME shared cue regexes — single source of truth). */
  readonly hasOwnRate: boolean;
}

const COMPILED: readonly CompiledLane[] = LANE_REGISTRY.map((entry) => ({
  entry,
  matcher: compileMatcher(entry),
  hasOwnRate: entry.allowedContexts.some((c) => c.kind === "own-rate"),
}));

/**
 * OWN-RATE escape (v0.5.0, Kelly ruling 2026-06-03). True iff the window around a
 * `rate offer` match references the LEAD'S OWN existing rate (`OWN_RATE_CUES`) and
 * carries NO prospective-offer framing (`OFFER_CUES`). Mirrors rate-claims
 * `scanRegZ` exactly and reuses its shared cue regexes + window, so the lane and
 * rate-claims scanners agree: "your current rate is 2.88%" / "your rate is still
 * one of the best" are excused, while "your rate will be 5.5%" / "your new rate
 * could be 5.5%" / "I can offer you a rate of …" STILL flag.
 */
function isOwnRate(masked: string, matchIndex: number, matchLength: number): boolean {
  const start = Math.max(0, matchIndex - OWN_RATE_WINDOW);
  const end = Math.min(masked.length, matchIndex + matchLength + OWN_RATE_WINDOW);
  const ctx = masked.slice(start, end);
  return OWN_RATE_CUES.test(ctx) && !OFFER_CUES.test(ctx);
}

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

  for (const { entry, matcher, hasOwnRate } of COMPILED) {
    if (!applicable.has(entry.lane)) continue;
    for (const { index, matchedText } of runMatcher(matcher, text, masked, words, opts.disclaimerRanges)) {
      // OWN-RATE escape (v0.5.0): excuse a `rate offer` match that references the
      // lead's OWN existing rate with no prospective-offer cue. Mirrors the
      // rate-claims scanRegZ carve-out via the SAME shared regexes so the two
      // scanners never disagree on what "the lead's own rate" means.
      if (hasOwnRate && isOwnRate(masked, index, matchedText.length)) continue;
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
