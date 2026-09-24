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
  it("the LIVE-violation sentence: UDAAP flags, and since A7 so does its Reg-Z half (three connectives between 'fixed' and the figure)", () => {
    const t =
      "the 30-year fixed is sitting around 5.5% right now, which is actually running below the broader market average";
    const tokens = tokensOf(t);
    assert.ok(tokens.includes("udaap_rate_comparison"), "UDAAP");
    assert.ok(tokens.includes("regz_rate_figure_no_apr"), "A7: 'is sitting around' is a connective phrase — see the A7 block below");
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
      // K-13 needed the noun adjacent; since A7 "rate could be 5.5%" also flags
      // (pinned in the K-13 block). These forms keep the noun adjacent.
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

  it("the offer sentences K-13 released: A7 catches the noun-first ones; the rest stay released, pinned so it is visible", () => {
    // K-13 released every one of these (two or more words between noun and
    // figure). A7 (2026-09-24) widened the noun-first direction by measurement
    // (see the A7 block), so the first five now flag; the Reg-Z offer guard runs
    // on them again.
    for (const t of [
      "the 30-year fixed is sitting around 5.5% right now",
      "Rates are at 6.4% right now.",
      "Your new rate could be 5.5%.",
      "Your rate will be 5.5%.",
      "We could get your rate down to 5.5%.",
    ]) {
      assert.equal(regz(t), 1, `A7 flags: ${t}`);
    }
    // Still released: figure-first with more than one word to the noun (A7
    // widened noun-first only), and "30-yr", which is not a rate noun.
    for (const t of [
      "I'm offering 6.1% on a 30-year fixed.",
      "we can lock you in at 6.0% on a fixed",
      "30-yr is now 6.4%.",
    ]) {
      assert.equal(regz(t), 0, `still released: ${t}`);
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

// ── A7 (2026-09-24): the rate noun governs across a bounded phrase ───────────
// K-13 let at most ONE preposition or verb sit between the noun and the figure,
// so "Rates are around 6.25%" and "the average 30-year rate sits near 6.3%" were
// not rate figures. They skipped the Reg-Z check, and Milo's A3 grounding then
// accepted the figure as a market value. The window is now: the noun, then up
// to RATE_PHRASE_MAX_WORDS connective/adverb words (every one of them from the
// connective list), then the figure. Any other word between them (a noun: "cuts",
// "costs", "values", "sales") still breaks the phrase, so the K-13/K-30 market
// releases hold. Measured on 2,624 ClearPath bodies (30 days, EmailBody + Milo
// final outputs): all 15 distinct rate sentences sat 3–6 words from the noun,
// and 13 of 15 were within 4.
describe("rate-claims — A7: a rate noun governs the figure across a bounded connective phrase", () => {
  const regz = (t) => tokensOf(t).filter((x) => x === "regz_rate_figure_no_apr").length;
  const figures = (t) => classifyPercentFigures(t).map((f) => [f.matchedText, f.isRateFigure]);

  it("Agent 1's two sentences: both rate figures are now read as rates, the YoY delta is not", () => {
    assert.deepEqual(figures("Rates are around 6.25% right now."), [["6.25%", true]]);
    assert.equal(regz("Rates are around 6.25% right now."), 1);
    assert.deepEqual(
      figures("Home values rose 2.4% year-over-year while the average 30-year rate sits near 6.3%."),
      [["2.4%", false], ["6.3%", true]],
    );
  });

  it("rates two to four connective words from their noun are caught", () => {
    for (const t of [
      "Rates are at 6.4% right now.",
      "the average 30-year rate sits near 6.3% this week",
      "the 30-year fixed is sitting around 5.5% right now",
      "The 15-year is currently at 5.75% for well-qualified buyers.",
      "The 30-year fixed is currently around 6.25% this week.",
      "Rates are still near 6.1% heading into fall.",
      "Rates have been hovering around 6.5% this month.",
      "A 30-year fixed today is sitting around 6.9%.",
      "Rates are down to 6.1%.",
      "Your new rate could be 5.5%.",
      "Your rate will be 5.5%.",
    ]) {
      assert.equal(regz(t), 1, `must flag: ${t}`);
    }
  });

  it("market percentages two or three words from a rate noun are NOT rates: a non-connective word breaks the phrase", () => {
    for (const t of [
      "Rate cuts lifted sales 5% last quarter.",
      "Fixed costs rose 3% this year.",
      "Rates and values rose 4% this year.",
      "The 30-year median gained 4% since spring.",
      "Rate shoppers saved about 2% on closing costs.",
      "The 10-year Treasury yield rose 0.1% overnight.",
      "A 5-year high of 7% in new listings.",
      "15-year owners gained 8% in equity.",
      "Home values rose 2.4% year-over-year while the average 30-year rate sits near 6.3%.",
    ]) {
      const market = classifyPercentFigures(t).filter((f) => !/6\.3%/.test(f.matchedText));
      assert.ok(market.length > 0, `fixture has no market figure: ${t}`);
      for (const f of market) assert.equal(f.isRateFigure, false, `must NOT be a rate: ${f.matchedText} in "${t}"`);
    }
  });

  it("the stored real-row shapes: rate figures behind 'is sitting at' / 'are currently sitting around' are rates even at two decimals", () => {
    for (const t of [
      "the 30-year fixed is sitting at 6.50% right now",
      "Rates on a 30-year fixed are currently sitting around 6.50%.",
      "the offered 30-year fixed today is sitting around 6.99%.",
    ]) {
      assert.equal(regz(t), 1, `must flag: ${t}`);
    }
  });

  it("five connective words is past the window; a relative clause is not a connective", () => {
    // Pinned so the edge is visible. Both real-row examples carry three
    // decimals, which is how they were caught before and still are.
    assert.equal(regz("Rates have still been hovering around 6.5% lately."), 0);
    assert.equal(regz("the 30-year fixed I'm quoting right now is 6.62%"), 0);
    assert.equal(regz("the 30-year fixed I'm quoting right now is 6.625%"), 1);
  });

  it("the figure-before-noun direction is unchanged: one connective at most", () => {
    // "6.1% on a 30-year fixed" is a real offer, but widening this direction
    // also reads "3.5% on a 30-year loan" (a down payment) as a rate. That needs
    // its own ruling; A7 widens the noun-first direction only.
    assert.equal(regz("I'm offering 6.1% on a 30-year fixed."), 0);
    assert.equal(regz("a 6.1% 30-year fixed"), 1, "noun directly after the figure");
    assert.equal(regz("6.1% fixed for 30 years"), 1);
    assert.equal(regz("3.5% on a 30-year loan"), 0);
  });
});

// ── D-70 (2026-09-24, auditor row A-178): a rate MOVEMENT is not a rate figure ─
// A percentage governed by a movement verb (rose, fell, dropped, down, up,
// lifted, cut, climbed, slipped, eased) is a delta or a market statement, not
// an advertised rate, UNLESS it is stated as a level ("to 6.1%", "at 6.1%",
// "is/are 6.1%", "sits near 6.1%") or carries three decimals. The K-30 class
// (YoY deltas) generalised from "year over year" to the verb. A level is still
// a rate, so disclosure is preserved.
describe("rate-claims — D-70: a rate movement is not a rate figure; a level still is", () => {
  const regz = (t) => tokensOf(t).filter((x) => x === "regz_rate_figure_no_apr").length;
  const figures = (t) => classifyPercentFigures(t).map((f) => [f.matchedText, f.isRateFigure]);

  it("movements are released", () => {
    for (const t of [
      "Rates are down 3%",
      "Rates have dropped roughly 0.5%",
      "Rates fell 3%",
      "Rates rose 0.25% this week.",
      "The 30-year fixed dropped about 0.4% since June.",
      "Rates are down about 0.5% from last month.",
      "Rates climbed 0.2% after the Fed meeting.",
      "The 15-year fell by 0.3%.",
      "Rates are down almost 1% since spring.",
    ]) {
      assert.equal(regz(t), 0, `movement must release: ${t}`);
    }
  });

  it("levels are kept, including the two traps", () => {
    for (const t of [
      "Rates fell to 6.1%",
      "the 30-year is 6.3% today",
      "Your new rate could be 5.9%",
      "Rates are down to 6.1%.",
      "The 30-year fixed fell to around 6.25% this week.",
      "Rates sit near 6.4% after the dip.",
      "We could get your rate down to 5.5%.",
      "Rates have been hovering around 6.5% this month.",
    ]) {
      assert.equal(regz(t), 1, `level must stay a rate: ${t}`);
    }
    // Three decimals: a rate, whatever verb governs it.
    assert.equal(regz("rates are at 6.125%"), 1);
    assert.equal(regz("Rates rose 0.125% this week."), 1);
  });

  it("a delta and a level in one phrase: the delta releases, the level is kept", () => {
    assert.deepEqual(figures("Rates are down 0.5% to 6.1%."), [["0.5%", false], ["6.1%", true]]);
    assert.deepEqual(figures("Rates dropped from 7% to 6.1%."), [["7%", true], ["6.1%", true]]);
  });

  it("the NS-pinned sentences were never package rates (A7 already releases them)", () => {
    assert.deepEqual(figures("Rate cuts lifted sales 5% last quarter."), [["5%", false]]);
    assert.deepEqual(figures("Fixed costs rose 3% this year."), [["3%", false]]);
  });
});
