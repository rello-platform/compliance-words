import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  scanRateClaims,
  hasRateClaimViolation,
  RATE_CLAIM_CONFIG,
  classifyPercentFigures,
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
  it("the LIVE-violation sentence: UDAAP still flags; K-13 RELEASES its Reg-Z half (three words between 'fixed' and a two-decimal figure)", () => {
    const t =
      "the 30-year fixed is sitting around 5.5% right now, which is actually running below the broader market average";
    const tokens = tokensOf(t);
    assert.ok(tokens.includes("udaap_rate_comparison"), "UDAAP");
    assert.ok(!tokens.includes("regz_rate_figure_no_apr"), "K-13 releases the Reg-Z half — see the K-13 block below");
    // The same sentence with the noun governing, or three decimals, still flags Reg-Z.
    assert.ok(tokensOf("the 30-year fixed is 5.5% right now").includes("regz_rate_figure_no_apr"));
    assert.ok(tokensOf("the 30-year fixed is sitting around 5.500% right now").includes("regz_rate_figure_no_apr"));
  });

  it("flags rate figures a rate noun governs (K-13)", () => {
    for (const t of [
      "a 30-year at 6.1%",
      "a rate of 6.125%",
      "rates near 6%",
      "your interest rate could be 5.875%", // three decimals
      "we can lock you in at a fixed 6.0%",
    ]) {
      assert.ok(hasRateClaimViolation(t), `expected Reg-Z flag: ${t}`);
      assert.ok(tokensOf(t).includes("regz_rate_figure_no_apr"), t);
    }
  });

  it("a bare three-decimal figure is a rate (K-13); a bare two-decimal figure is not", () => {
    assert.ok(tokensOf("6.125%.").includes("regz_rate_figure_no_apr"));
    assert.deepEqual(tokensOf("6.12%."), []);
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

// ── REG-Z lead-owned-rate escape (Kelly ruling 2026-06-03) ──────────────────
describe("rate-claims — REG-Z lead-owned-rate escape", () => {
  it("ALLOWS a factual statement about the LEAD'S OWN existing rate", () => {
    for (const t of [
      "Your current rate is 2.88%, which is great.",
      "You're sitting on a 2.94% rate — hold onto it.",
      "Saw your 6.5% rate alert come through.",
      "Your 2.67% rate is well below today's market.",
      "Their current rate is 3.1% on the existing loan.",
      "The rate you locked at 3.25% is fantastic.",
      "Your existing rate of 3.0% is hard to beat.",
    ]) {
      assert.equal(
        tokensOf(t).filter((x) => x === "regz_rate_figure_no_apr").length,
        0,
        `expected no Reg-Z flag (lead's own rate): ${t}`,
      );
    }
  });

  it("STILL flags a MARKET / advertised-OFFER rate without APR", () => {
    for (const t of [
      "Rates at 6.4% right now.",
      "the 30-year is 6.4%.",
      "I'm offering a rate of 5.5%.",
      "a rate of 6.1%",
    ]) {
      assert.ok(
        tokensOf(t).includes("regz_rate_figure_no_apr"),
        `expected Reg-Z flag (market/offer rate): ${t}`,
      );
    }
  });

  it("STILL flags a PROSPECTIVE offer even with a possessive 'your'", () => {
    for (const t of [
      // K-13: the noun must govern — "rate could be 5.5%" has two words between
      // and RELEASES (pinned in the K-13 block); these forms keep the noun adjacent.
      "Your new rate is 5.5%.",
      "We could get your rate to 5.5%.",
      "You could get a 5.5% rate if you refi.",
      // v0.5.0: future-tense quote is a prospective offer (shared OFFER_CUES gained
      // "will be"/"would be" so the lane + rate-claims scanners agree).
      "Your rate will be 5.500%.", // three decimals — the only way a two-word bridge flags
      "Your rate would be 5.500% after closing.",
    ]) {
      assert.ok(
        tokensOf(t).includes("regz_rate_figure_no_apr"),
        `expected Reg-Z flag (prospective offer, not existing rate): ${t}`,
      );
    }
  });

  it("ALLOWS the lead's own rate paired with APR too (still no flag)", () => {
    assert.equal(
      tokensOf("Your current rate is 2.88% APR.").filter((x) => x === "regz_rate_figure_no_apr").length,
      0,
    );
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
    assert.ok(tokensOf("<b>The 30-year fixed is 5.5%</b> right now.").includes("regz_rate_figure_no_apr"));
    assert.ok(tokensOf("<p>mortgage rates<br/>near 6.5%</p>").includes("regz_rate_figure_no_apr"), "a tag does not hide the noun");
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

// ── K-13 / K-30 (2026-09-16): a percent is a rate figure only when a RATE NOUN
// governs it in the same clause, or it carries three decimals. A preposition
// never anchors. The same rule Rello's send-time `containsRateClaim` applies
// (Rello #1327): rate / rates / APR / fixed / N-year immediately before or
// after the figure with at most ONE preposition or verb between; a clause ends
// at . ! ? ; : , or a line break. Measured on ClearPath bodies before it
// shipped there: the withdrawn preposition list withheld "values are up about
// 2.4%" on 78 of 986 bodies. On Milo the old cue-window read "2.4%" (a YoY
// delta beside the word "rates") as a bare rate and sent a Big Star compose to
// the safe template (K-30).
describe("rate-claims — K-13: a rate noun governs the figure, or three decimals", () => {
  const regz = (t) => tokensOf(t).filter((x) => x === "regz_rate_figure_no_apr").length;

  it("the eight ruling fixtures: four flag, 6.99% APR is disclosed, three release", () => {
    for (const t of ["rate of 6.75%", "rates near 6.75%", "a fixed 7 % loan", "the 30-year is sitting at 6.990%"]) {
      assert.equal(regz(t), 1, `must flag: ${t}`);
    }
    // Governed by the APR noun → a rate figure; APR present → properly disclosed.
    assert.equal(regz("6.99% APR"), 0, "6.99% APR is disclosed");
    for (const t of ["values are up about 2.4%", "up around 2.4%", "mortgage applications rose 5%"]) {
      assert.equal(regz(t), 0, `must release: ${t}`);
    }
  });

  it("the Big Star span: a YoY delta in the clause before a rate word releases", () => {
    for (const t of [
      "Values across Sandy are up 2.4% year over year (Zillow home-value index, as of July 2026), even as mortgage rates hold steady.",
      "Home values rose 2.4% year over year while rates stayed put.",
      "Sandy values are up 2.4% and rates have eased a bit lately.",
    ]) {
      assert.equal(regz(t), 0, `must release: ${t}`);
    }
  });

  it("a preposition never anchors: 'at 20% down', 'sits at 3% above' release; a bare two-decimal figure is not a rate", () => {
    for (const t of [
      "inventory sits at 3% above last year", "Put 20% down and skip PMI.", "6.12%.", "25% down payment", "the 10-year Treasury moved 0.10%",
      // a clause boundary stops the noun reaching the figure
      "Talk to us about your rate, at 20% down you avoid PMI",
      "Rates are moving. At 20% down you skip PMI.",
      "the rate\nat 20% down",
    ]) {
      assert.equal(regz(t), 0, `must release: ${t}`);
    }
  });

  it("K-13 RELEASES the offer sentences the old cue-window flagged — pinned so the release is visible, not silent", () => {
    // Two or more words between the noun and the figure is outside the ruling
    // ("is sitting around", "are at", "is now", "on a"); only three decimals
    // would catch them. Widen by measurement (Rello's sweep-rate-claim-emailbody), not by argument.
    for (const t of [
      "the 30-year fixed is sitting around 5.5% right now",
      "I'm offering 6.1% on a 30-year fixed.",
      "we can lock you in at 6.0% on a fixed",
      "Rates are at 6.4% right now.",
      "30-yr is now 6.4%.",
      "Your new rate could be 5.5%.", // "could be": two words — the v0.5.0 offer guard never runs because K-13 says this is not a rate figure
      "Your rate will be 5.5%.",
      "We could get your rate down to 5.5%.",
    ]) {
      assert.equal(regz(t), 0, `K-13 releases: ${t}`);
    }
    // …and STILL flags the same offers when the noun governs or the figure carries three decimals.
    for (const t of ["the 30-year fixed is 5.5% right now", "a rate of 6.1% on a 30-year fixed", "rates at 6.4% right now", "30-yr is now 6.375%."]) {
      assert.equal(regz(t), 1, `must flag: ${t}`);
    }
  });
});

describe("classifyPercentFigures — the K-13 primitive for consumers (v0.7.1)", () => {
  it("labels each percent by whether a rate noun governs it, or three decimals", () => {
    const r = classifyPercentFigures("Values are up 6% year over year, and a rate of 6% is common; the 30-year sits at 6.125%.");
    assert.deepEqual(r.map((x) => [x.matchedText, x.isRateFigure]), [["6%", false], ["6%", true], ["6.125%", true]]);
  });
  it("returns [] on empty / non-string input", () => {
    assert.deepEqual(classifyPercentFigures(""), []);
    assert.deepEqual(classifyPercentFigures(undefined), []);
  });
});
