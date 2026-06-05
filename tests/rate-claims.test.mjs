import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  scanRateClaims,
  hasRateClaimViolation,
  RATE_CLAIM_CONFIG,
} from "../dist/index.js";

const tokensOf = (text, opts) =>
  scanRateClaims(text, opts).map((v) => v.token).sort();

// ── DRAFT posture ─────────────────────────────────────────────────────────
describe("rate-claims — DRAFT posture", () => {
  it("config is DRAFT, warn-only, not armed", () => {
    assert.equal(RATE_CLAIM_CONFIG.status, "DRAFT");
    assert.equal(RATE_CLAIM_CONFIG.defaultSeverity, "WARNING");
    assert.equal(RATE_CLAIM_CONFIG.armed, false);
    assert.deepEqual([...RATE_CLAIM_CONFIG.tokens], [
      "regz_rate_figure_no_apr",
      "udaap_rate_comparison",
    ]);
  });

  it("every finding defaults to WARNING (never HARD_BLOCK unarmed)", () => {
    const v = scanRateClaims(
      "The 30-year fixed is around 5.5%, running below the broader market average.",
    );
    assert.ok(v.length > 0);
    for (const f of v) assert.equal(f.severity, "WARNING");
  });

  it("severityFloor can RAISE (arming) but never LOWER", () => {
    const armed = scanRateClaims("a rate of 6.125%.", { severityFloor: "HARD_BLOCK" });
    assert.equal(armed[0].severity, "HARD_BLOCK");
    const lowered = scanRateClaims("a rate of 6.125%.", { severityFloor: "REVIEW_FLAG" });
    assert.equal(lowered[0].severity, "WARNING");
  });
});

// ── REG-Z rule ──────────────────────────────────────────────────────────────
describe("rate-claims — REG-Z (rate figure without APR)", () => {
  it("flags the LIVE-violation sentence", () => {
    const t =
      "the 30-year fixed is sitting around 5.5% right now, which is actually running below the broader market average";
    const tokens = tokensOf(t);
    assert.ok(tokens.includes("regz_rate_figure_no_apr"), "Reg-Z");
    assert.ok(tokens.includes("udaap_rate_comparison"), "UDAAP");
  });

  it("flags rate figures in interest/mortgage context", () => {
    for (const t of [
      "I'm offering 6.1% on a 30-year fixed.",
      "a rate of 6.125%",
      "rates near 6%",
      "your interest rate could be 5.875%",
      "we can lock you in at 6.0% on a fixed",
    ]) {
      assert.ok(hasRateClaimViolation(t), `expected Reg-Z flag: ${t}`);
      assert.ok(tokensOf(t).includes("regz_rate_figure_no_apr"), t);
    }
  });

  it("flags a bare ambiguous % with no context (conservative)", () => {
    assert.ok(tokensOf("6.125%.").includes("regz_rate_figure_no_apr"));
  });

  it("ALLOWS a rate figure paired with APR (properly disclosed)", () => {
    for (const t of [
      "6.1% APR on a 30-year fixed — fully disclosed.",
      "The annual percentage rate is 6.4% APR.",
    ]) {
      assert.equal(
        tokensOf(t).filter((x) => x === "regz_rate_figure_no_apr").length,
        0,
        `expected no Reg-Z flag (APR present): ${t}`,
      );
    }
  });

  it("ALLOWS home-VALUE / appreciation figures (not a rate)", () => {
    for (const t of [
      "Prices are up 5% from last year.",
      "Home values rose roughly 5% year over year.",
      "Your equity grew about 8% as values climbed.",
    ]) {
      assert.deepEqual(scanRateClaims(t), [], `expected clean: ${t}`);
    }
  });

  it("ALLOWS directional rate language (no figure)", () => {
    assert.deepEqual(scanRateClaims("Rates have eased a bit lately."), []);
    assert.deepEqual(scanRateClaims("Ask your loan officer about today's rates."), []);
  });
});

// ── UDAAP rule ────────────────────────────────────────────────────────────
describe("rate-claims — UDAAP (rate self-comparison)", () => {
  it("flags below-market / comparison / superlative claims", () => {
    for (const t of [
      "running below the broader market average",
      "below market",
      "below the market rate",
      "rates lower than other lenders",
      "better than the banks",
      "we beat any rate",
      "we'll beat any competitor",
      "nobody can beat our pricing",
      "our rates can't be beat",
      "unbeatable rates",
      "get the lowest rate around",
      "the best rates in town",
      "most competitive rates anywhere",
      "rates nobody can match",
      "40 bps below market",
      "25 basis points below the going rate",
    ]) {
      assert.ok(
        tokensOf(t).includes("udaap_rate_comparison"),
        `expected UDAAP flag: ${t}`,
      );
    }
  });

  it("ALLOWS factual data-sourced market/value stats", () => {
    for (const t of [
      "The median sale price in your zip is around 5% higher than last year.",
      "Active listings are up 12% from a year ago.",
      "Home values are up 5% from last year.",
    ]) {
      assert.equal(
        tokensOf(t).filter((x) => x === "udaap_rate_comparison").length,
        0,
        `expected no UDAAP flag: ${t}`,
      );
    }
  });
});

// ── HTML masking + disclaimer + degenerate input ─────────────────────────────
describe("rate-claims — masking / disclaimer / degenerate", () => {
  it("masks HTML tags (offset preserved, tag content ignored)", () => {
    assert.ok(tokensOf("<b>The 30-year fixed is around 5.5%</b> right now.").includes("regz_rate_figure_no_apr"));
  });

  it("excuses a match inside a caller-marked disclaimer range", () => {
    const ref = "Illustrative only: a rate of 6.125%.";
    assert.ok(hasRateClaimViolation(ref));
    assert.deepEqual(scanRateClaims(ref, { disclaimerRanges: [[0, ref.length]] }), []);
  });

  it("returns [] on empty / non-string input (no throw)", () => {
    assert.deepEqual(scanRateClaims(""), []);
    assert.deepEqual(scanRateClaims(null), []);
    assert.deepEqual(scanRateClaims(12345), []);
    assert.equal(hasRateClaimViolation(""), false);
  });
});
