import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  COMPLIANCE_REGISTRY,
  COMPLIANCE_TOKEN_SET,
  NEGATION_CUES,
  DEFAULT_NEGATION_PROXIMITY,
  DEFAULT_LIST_NEGATION_PROXIMITY,
  CLAUSE_BREAKERS,
  LIST_COORDINATORS,
  listComplianceEntries,
  checkCompliance,
  hasHardBlock,
} from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const tokensOf = (text, opts) => checkCompliance(text, opts).map((v) => v.token).sort();

// ── (a) Completeness contract ───────────────────────────────────────────────
describe("registry — completeness", () => {
  it("holds the reconciled 10 prohibited tokens + the AI identity rule = 11 rows", () => {
    assert.equal(COMPLIANCE_REGISTRY.length, 11);
    assert.equal(COMPLIANCE_TOKEN_SET.size, 11);
    assert.equal(listComplianceEntries().length, 11);
  });

  it("carries exactly the spec's reconciled tokens", () => {
    const expected = [
      "AI",
      "approval",
      "final",
      "free money",
      "guarantee",
      "lock",
      "offer",
      "pre-qualified",
      "quote",
      "risk-free",
      "won't lose your home",
    ];
    assert.deepEqual([...COMPLIANCE_TOKEN_SET].sort(), expected);
  });

  it("every entry declares token + matchType + non-empty forms + category + allowedContexts + provenance", () => {
    for (const e of COMPLIANCE_REGISTRY) {
      assert.equal(typeof e.token, "string", `${e.token}: token`);
      assert.ok(["word-stem", "phrase", "word"].includes(e.matchType), `${e.token}: matchType`);
      assert.ok(Array.isArray(e.forms) && e.forms.length > 0, `${e.token}: forms non-empty`);
      // The canonical token must appear (as a word) in at least one form. For
      // word-stem/word the token IS a form; for phrase entries the token is the
      // lemma and appears inside a collocation form (e.g. `offer` ∈ "special
      // offer" after Gap 2 narrowed `offer` to its prohibited collocations).
      assert.ok(
        e.forms.some((f) => f === e.token || f.split(/[^a-z0-9]+/i).includes(e.token)),
        `${e.token}: token must appear as a word in at least one form`,
      );
      assert.ok(["HARD_BLOCK", "REVIEW_FLAG"].includes(e.category), `${e.token}: category`);
      assert.ok(Array.isArray(e.allowedContexts), `${e.token}: allowedContexts`);
      for (const c of e.allowedContexts) {
        assert.ok(["negation", "compound", "disclaimer-banner"].includes(c.kind), `${e.token}: ctx.kind`);
        assert.equal(typeof c.pattern, "string", `${e.token}: ctx.pattern`);
        assert.equal(typeof c.note, "string", `${e.token}: ctx.note`);
      }
      assert.ok(Array.isArray(e.provenance) && e.provenance.length > 0, `${e.token}: provenance`);
    }
  });

  it("only `final` is REVIEW_FLAG; every other row is HARD_BLOCK (spec reconciled defaults)", () => {
    const review = COMPLIANCE_REGISTRY.filter((e) => e.category === "REVIEW_FLAG").map((e) => e.token);
    assert.deepEqual(review, ["final"]);
  });

  it("the AI identity rule is a case-sensitive whole-word HARD_BLOCK suggesting 'Smart Assistant'", () => {
    const ai = COMPLIANCE_REGISTRY.find((e) => e.token === "AI");
    assert.equal(ai.matchType, "word");
    assert.equal(ai.category, "HARD_BLOCK");
    assert.equal(ai.suggest, "Smart Assistant");
  });
});

// ── (b) Live-evidence corpus — MUST produce ZERO violations ─────────────────
// The 7 live ACTIVE HecmContent S3 rows carry forbidden tokens only inside
// NOT-THAT / negation / compound / disclaimer-banner lines; the Report-Engine
// ILLUSTRATIVE_BANNER negates them. The context model must pass all of them.
describe("live-evidence corpus — zero false-positives on legit copy", () => {
  const REPORT_ENGINE_BANNER = "Illustrative — not a loan offer, quote, or approval.";

  const clean = [
    ["NOT-THAT: quote", "Say 'estimate', not 'quote'."],
    ["NOT-THAT: approval", "Say 'review', not an 'approval'."],
    ["NOT-THAT: offer", "This summary is not an offer, not a quote, and not an approval."],
    ["NOT-THAT: won't lose your home", "Say 'you keep your title', not 'you won't lose your home'."],
    ["Report-Engine illustrative banner (negated, no ranges)", REPORT_ENGINE_BANNER],
    ["USDA guarantee fee compound", "The USDA guarantee fee applies to this loan."],
    ["not a guarantee of value", "An estimate is not a guarantee of value."],
    ["rate-lock confirmation compound", "Your rate-lock confirmation is attached for your records."],
    ["Final Disclosure compound (REVIEW_FLAG token in a named doc)", "Review the Final Disclosure before closing."],
    ["final used in negation", "This number is not final until underwriting completes."],
  ];

  for (const [label, text] of clean) {
    it(`zero violations: ${label}`, () => {
      assert.deepEqual(checkCompliance(text), [], `unexpected: ${JSON.stringify(checkCompliance(text))}`);
    });
  }

  // NOTE — spec-corpus imprecision (surfaced to DKA, see DISCOVERED note in the
  // PR body): the spec §Edge-Cases lists "Rello's ledger guarantees these
  // reconcile" under "benign domain compounds asserted clean". It is NOT a
  // compound and carries no negation — it is an affirmative use of the
  // `guarantee` stem, which the spec's own three-mechanism context model
  // (negation | compound | disclaimer-banner) does not excuse. The checker
  // CORRECTLY flags it (borrower-facing-strict). We do not contort the model to
  // pass internal/illustrative affirmative copy; instead we assert the honest
  // behavior so the contract is explicit.
  it("affirmative `guarantees` in internal copy is (correctly) flagged — model is borrower-facing-strict", () => {
    assert.deepEqual(
      checkCompliance("Rello's ledger guarantees these reconcile.").map((v) => v.token),
      ["guarantee"],
    );
  });
});

// ── (c) Affirmative-claim corpus — MUST HARD_BLOCK ──────────────────────────
describe("affirmative-claim corpus — real violations are caught", () => {
  it("'We guarantee approval' → HARD_BLOCK guarantee + approval", () => {
    assert.deepEqual(tokensOf("We guarantee approval for every applicant."), ["approval", "guarantee"]);
    assert.equal(hasHardBlock("We guarantee approval for every applicant."), true);
  });

  it("'free money' → HARD_BLOCK", () => {
    assert.deepEqual(tokensOf("Free money for your closing costs."), ["free money"]);
  });

  it("'you're pre-qualified' → HARD_BLOCK", () => {
    assert.deepEqual(tokensOf("You're pre-qualified today — apply now."), ["pre-qualified"]);
  });

  it("'risk-free' → HARD_BLOCK", () => {
    assert.deepEqual(tokensOf("This is a risk-free investment."), ["risk-free"]);
  });

  it("affirmative lock/quote/offer → three HARD_BLOCKs", () => {
    assert.deepEqual(
      tokensOf("Lock your rate now and we'll quote you the best offer."),
      ["lock", "offer", "quote"],
    );
  });

  it("suggest substitutions surface on the violation", () => {
    const v = checkCompliance("We guarantee results.").find((x) => x.token === "guarantee");
    assert.equal(v.suggest, "designed to / built to");
    assert.match(v.message, /designed to \/ built to/);
  });

  it("sentence isolation: a negation in the PRIOR sentence does not excuse the claim", () => {
    assert.deepEqual(tokensOf("This is not allowed. We guarantee approval."), ["approval", "guarantee"]);
  });
});

// ── (d) AI identity rule ────────────────────────────────────────────────────
describe("AI identity rule", () => {
  it("'our AI' → HARD_BLOCK suggest Smart Assistant", () => {
    const v = checkCompliance("Our AI writes your emails.");
    assert.deepEqual(v.map((x) => x.token), ["AI"]);
    assert.equal(v[0].suggest, "Smart Assistant");
  });

  it("'OpenAI' (no word boundary) → clean", () => {
    assert.deepEqual(checkCompliance("OpenAI released a new model."), []);
  });

  it("lowercase 'ai' inside email/detail → clean (case-sensitive whole word)", () => {
    assert.deepEqual(checkCompliance("Check your email for the details."), []);
  });

  it("'Google AI' external proper-noun compound → clean", () => {
    assert.deepEqual(checkCompliance("Google AI is a competitor product."), []);
  });
});

// ── (e) Word-boundary false-positives a substring scan would hit ────────────
describe("word boundaries — NOT substring", () => {
  for (const [text, label] of [
    ["The quotient was high.", "quotient ≠ quote"],
    ["He blocked the road.", "blocked ≠ lock"],
    ["See you at five o'clock.", "o'clock ≠ lock"],
    ["Please finalize the deal.", "finalize ≠ final"],
    ["The coffer was empty.", "coffer ≠ offer"],
  ]) {
    it(`clean: ${label}`, () => {
      assert.deepEqual(checkCompliance(text), [], JSON.stringify(checkCompliance(text)));
    });
  }
});

// ── (f) HTML content (NS pre-send) ──────────────────────────────────────────
describe("HTML tokenization", () => {
  it("catches a token wrapped in tags", () => {
    assert.deepEqual(tokensOf("<b>guarantee</b> <i>approval</i>"), ["approval", "guarantee"]);
  });

  it("ignores a token inside a tag/attribute (URL in href)", () => {
    assert.deepEqual(checkCompliance('<a href="https://x.com/quote">click here</a>'), []);
  });
});

// ── (g) Disclaimer-banner — fail-safe-strict ────────────────────────────────
describe("disclaimer-banner ranges (fail-safe-strict)", () => {
  // "an example quote" + a bare "offer" (no promotional collocation): post-Gap-2
  // the bare `offer` no longer matches, so the unmarked block flags only `quote`.
  const banner = "Illustrative scenario: an example quote shown for comparison.";

  it("an UNMARKED illustrative block HARD_BLOCKs (fail-safe-strict)", () => {
    assert.equal(hasHardBlock(banner), true);
    assert.deepEqual(tokensOf(banner), ["quote"]);
  });

  it("the SAME block marked as a disclaimer range passes", () => {
    assert.deepEqual(checkCompliance(banner, { disclaimerRanges: [[0, banner.length]] }), []);
  });

  it("guarantee IS now disclaimer-exemptible (Gap 3 added disclaimer-banner context)", () => {
    const t = "Illustrative: we guarantee this rate.";
    // unmarked → blocks (fail-safe-strict); marked as a disclaimer range → passes
    // (v0.1.1 added a disclaimer-banner allowance to the `guarantee` entry).
    assert.deepEqual(tokensOf(t), ["guarantee"]);
    assert.deepEqual(checkCompliance(t, { disclaimerRanges: [[0, t.length]] }), []);
  });

  it("pre-qualified IS disclaimer-exemptible (Gap 3 P3 finding)", () => {
    // Use the -ed ADJECTIVE form: post-v0.1.2 the -ion NOUN "pre-qualification"
    // is cleared unconditionally as a product-name identity compound, so the
    // disclaimer-banner mechanism must be exercised with the claim adjective.
    const t = "Illustrative scenario: you are pre-qualified.";
    assert.deepEqual(tokensOf(t), ["pre-qualified"]);
    assert.deepEqual(checkCompliance(t, { disclaimerRanges: [[0, t.length]] }), []);
  });

  it("risk-free is NOT disclaimer-exemptible (negation-only — no compliant use)", () => {
    const t = "Illustrative: this is a risk-free investment.";
    // even marked as a disclaimer range, risk-free still blocks (entry carries no
    // disclaimer-banner allowance — suggest is 'delete').
    assert.deepEqual(tokensOf(t, { disclaimerRanges: [[0, t.length]] }), ["risk-free"]);
  });
});

// ── (h) REVIEW_FLAG vs HARD_BLOCK + category filter ─────────────────────────
describe("category semantics", () => {
  it("an affirmative 'final' is a REVIEW_FLAG, not a HARD_BLOCK", () => {
    const text = "This is the final amount you will pay.";
    const v = checkCompliance(text);
    assert.deepEqual(v.map((x) => x.token), ["final"]);
    assert.equal(v[0].category, "REVIEW_FLAG");
    assert.equal(hasHardBlock(text), false);
  });

  it("categories filter narrows the result set", () => {
    const text = "This final number is a guarantee.";
    assert.deepEqual(tokensOf(text), ["final", "guarantee"]);
    assert.deepEqual(tokensOf(text, { categories: ["HARD_BLOCK"] }), ["guarantee"]);
    assert.deepEqual(tokensOf(text, { categories: ["REVIEW_FLAG"] }), ["final"]);
  });
});

// ── (i) Empty / null / non-string input (no throw) ──────────────────────────
describe("degenerate input", () => {
  it("returns [] for empty/undefined/null/non-string", () => {
    assert.deepEqual(checkCompliance(""), []);
    assert.deepEqual(checkCompliance(undefined), []);
    assert.deepEqual(checkCompliance(null), []);
    assert.deepEqual(checkCompliance(12345), []);
    assert.equal(hasHardBlock(""), false);
  });
});

// ── (j) Negation proximity & cue coverage ───────────────────────────────────
describe("negation mechanics", () => {
  it("a cue just inside the proximity window excuses; just outside does not", () => {
    // proximity default 6 = the cue may sit up to 6 words before the match.
    // "not" → 5 words → "guarantee": distance 5 ≤ 6 → excused.
    const inWindow = "We do not really truly very much guarantee anything.";
    assert.deepEqual(checkCompliance(inWindow), []);
    // "Not" → 8 words → "guarantee": distance 8 > 6 → blocks.
    const outWindow = "Not one two three four five six seven guarantee.";
    assert.deepEqual(tokensOf(outWindow), ["guarantee"]);
  });

  it("the canonical cues are present", () => {
    for (const cue of ["not", "no", "never", "cannot", "won't", "isn't"]) {
      assert.ok(NEGATION_CUES.includes(cue), `missing cue: ${cue}`);
    }
    assert.equal(DEFAULT_NEGATION_PROXIMITY, 6);
  });
});

// ── (v0.1.1) Gap 1 — federal/program-designation compounds ──────────────────
// Live blocking copy (8 Rello HecmContent rows + 31 RE grandfathered trips) that
// v0.1.0 false-HARD_BLOCKed on a fixed federal/program term. Each MUST now be
// clean while a real affirmative claim with the same stem still blocks.
describe("Gap 1 — federal/program-designation compounds", () => {
  const clean = [
    // HUD-approved (the mandatory HECM counseling line + condo eligibility)
    ["HUD-approved counselor (mandatory HECM line)", "Every borrower completes a session with an independent HUD-approved counselor before applying."],
    ["HUD-approved counseling", "Every HECM borrower must receive HUD-approved counseling first."],
    ["HUD-approved housing counselors", "HUD-approved housing counselors can help you decide."],
    ["HUD-approved condominium", "The borrower occupies one unit of a HUD-approved condominium."],
    ["FHA/HUD-approved", "A condo project has to be FHA/HUD-approved, not just the unit."],
    ["HUD's approved list", "Check whether the project is on HUD's approved list before applying."],
    ["single-unit approval", "We check whether single-unit approval is an option."],
    ["condo-approval field", "The workspace has a separate condo-approval field for exactly this."],
    // guarantee fee / MIP-Guarantee label
    ["annual guarantee fee", "No down payment. 1% upfront + 0.35% annual guarantee fee."],
    ["MIP / Guarantee column label", "Column: MIP / Guarantee shown per loan type."],
    // lock days transactional label
    ["lock days label", "Lock days: 45 for this scenario."],
  ];
  for (const [label, text] of clean) {
    it(`zero violations: ${label}`, () => {
      assert.deepEqual(checkCompliance(text), [], `unexpected: ${JSON.stringify(checkCompliance(text))}`);
    });
  }

  it("the same stems STILL block as affirmative claims (no over-loosening)", () => {
    assert.deepEqual(tokensOf("You're approved — congratulations!"), ["approval"]);
    assert.deepEqual(tokensOf("We guarantee the lowest rate, period."), ["guarantee"]);
    assert.deepEqual(tokensOf("Lock your rate today before it rises."), ["lock"]);
  });
});

// ── (v0.1.1) Gap 2 — ordinary verb/participle uses of offer/offered ─────────
describe("Gap 2 — ordinary offer/offered cleared; promotional collocations still block", () => {
  const clean = [
    ["offered rate (methodology)", "The workspace prices off your real offered rate rather than the placeholder."],
    ["MLO's offered HECM rate", "Effective rate uses the MLO's offered HECM rate where available."],
    ["offer to include the family", "When family is involved, offer to include them in the conversation."],
    ["record it when offered", "This is optional; record it cleanly when offered, skip it without friction."],
    ["could offer (verb)", "It builds more trust than any reassurance you could offer."],
    ["Offered at (label)", "Offered at: the rate captured at generation time."],
  ];
  for (const [label, text] of clean) {
    it(`zero violations: ${label}`, () => {
      assert.deepEqual(checkCompliance(text), [], `unexpected: ${JSON.stringify(checkCompliance(text))}`);
    });
  }

  it("promotional offer collocations STILL HARD_BLOCK", () => {
    assert.deepEqual(tokensOf("Limited-time offer — act now!"), ["offer"]);
    assert.deepEqual(tokensOf("This is a special offer just for you."), ["offer"]);
    assert.deepEqual(tokensOf("Exclusive offer: refinance this week."), ["offer"]);
    assert.deepEqual(tokensOf("This offer expires Friday."), ["offer"]);
    assert.equal(hasHardBlock("Limited time offer ends soon."), true);
  });
});

// ── (v0.1.1) Gap 3 — list-aware negation + wider disclaimer windows ─────────
describe("Gap 3 — single negation cue distributes over a coordinated NOT-THAT list", () => {
  const clean = [
    // Live Rello comp-illustrative-vs-quote row (was 4 HARD_BLOCKs)
    ["Rello NOT-THAT list (never call it …)", "Critical: never call a workspace number an offer, a quote, an approval, a lock, or a pre-qualification."],
    // Live RE disclaimer sentences (DISCLAIMER_NEGATION_PROXIMITY trips)
    ["RE 'not a commitment to lend or a guarantee of loan approval'", "It is not a commitment to lend or a guarantee of loan approval."],
    ["RE 'not a loan offer, quote, approval, or commitment'", "This is an illustrative estimate — not a loan offer, quote, approval, or commitment to lend."],
    ["RE pre-qual disclaimer (negated guarantee/approval)", "This estimate is based on information provided. It is not a commitment to lend or a guarantee of loan approval."],
  ];
  for (const [label, text] of clean) {
    it(`zero violations: ${label}`, () => {
      assert.deepEqual(checkCompliance(text), [], `unexpected: ${JSON.stringify(checkCompliance(text))}`);
    });
  }

  it("list-distribution does NOT cross a clause boundary (no over-excuse)", () => {
    // 'so' is a clause breaker → the negation does not reach 'guarantee'.
    assert.deepEqual(
      tokensOf("We never want you to feel pressured, so we guarantee a great rate."),
      ["guarantee"],
    );
    // A far cue with NO comma/or coordinator does not distribute either.
    assert.deepEqual(
      tokensOf("Not one two three four five six seven eight guarantee approval."),
      ["approval", "guarantee"],
    );
  });

  it("the list window + clause breakers + coordinators are exported & sane", () => {
    assert.equal(DEFAULT_LIST_NEGATION_PROXIMITY, 18);
    assert.ok(CLAUSE_BREAKERS.includes("so") && CLAUSE_BREAKERS.includes("but"));
    assert.deepEqual([...LIST_COORDINATORS], ["or", "nor"]);
  });
});

// ── (v0.1.2) Ruling 1 — "pre-qualified" product-name identity (Kelly 2026-06-01)
describe("Ruling 1 — pre-qualification product-name noun cleared; the claim adjective still blocks", () => {
  const clean = [
    ["document title", "Pre-Qualification Summary"],
    ["lowercase title in prose", "the pre-qualification summary letter"],
    ["status label", "Pre-Qualification"],
    ["self-reference in a disclaimer", "This pre-qualification is based on information provided and is subject to verification."],
    ["official pre-qualification", "Ask your loan officer for an official pre-qualification."],
    ["unhyphenated noun", "Your prequalification is ready to review."],
  ];
  for (const [label, text] of clean) {
    it(`zero violations: ${label}`, () => {
      assert.deepEqual(checkCompliance(text), [], `unexpected: ${JSON.stringify(checkCompliance(text))}`);
    });
  }

  it("the advertising CLAIM (the -ed adjective applied to the borrower) STILL HARD_BLOCKs", () => {
    // Kelly's two explicit must-stay-blocked examples + siblings.
    assert.deepEqual(tokensOf("You're pre-qualified today — apply now!"), ["pre-qualified"]);
    assert.deepEqual(tokensOf("You are pre-qualified, lock your rate."), ["lock", "pre-qualified"]);
    assert.deepEqual(tokensOf("Get pre-qualified now."), ["pre-qualified"]);
    assert.equal(hasHardBlock("You're pre-qualified!"), true);
  });

  it("the 3rd-person status adjective is the documented residual — still in scope", () => {
    // "<borrower> is pre-qualified" uses the -ed adjective and stays blocked so
    // the 2nd-person claim cannot slip (registry comment + DKA report).
    assert.deepEqual(tokensOf("John Smith is pre-qualified for these programs."), ["pre-qualified"]);
  });
});

// ── (v0.1.2) Ruling 2 — institutional-approval disclaimer compounds ──────────
describe("Ruling 2 — institutional approval-gate disclaimers cleared; promo claim still blocks", () => {
  const clean = [
    ["subject to underwriting approval", "Rates and terms are subject to underwriting approval."],
    ["underwriting approval are required", "Full application, credit review, appraisal, and underwriting approval are required."],
    ["subject to credit approval", "Your loan is subject to credit approval."],
    ["lender approval required", "Lender approval required before closing."],
    ["approval is not guaranteed", "Approval is not guaranteed."],
  ];
  for (const [label, text] of clean) {
    it(`zero violations: ${label}`, () => {
      assert.deepEqual(checkCompliance(text), [], `unexpected: ${JSON.stringify(checkCompliance(text))}`);
    });
  }

  it("the genuine promotional approval claim STILL HARD_BLOCKs (no over-loosening)", () => {
    assert.deepEqual(tokensOf("Get loan approval today."), ["approval"]);
    assert.deepEqual(tokensOf("You're approved — congratulations!"), ["approval"]);
    assert.deepEqual(tokensOf("We guarantee approval for every applicant."), ["approval", "guarantee"]);
  });
});

// ── (k) Cross-language keyset (committed dist artifact) ──────────────────────
describe("dist/compliance-words-keyset.json", () => {
  const keyset = JSON.parse(
    readFileSync(join(root, "dist", "compliance-words-keyset.json"), "utf8"),
  );

  it("names the package + version and carries all 11 entries", () => {
    assert.equal(keyset.package, "@rello-platform/compliance-words");
    assert.equal(keyset.version, "0.5.0");
    assert.equal(keyset.entries.length, 11);
  });

  it("carries the full matcher config the Python consumer needs (incl. v0.1.1 list-negation params)", () => {
    assert.ok(Array.isArray(keyset.negationCues) && keyset.negationCues.length > 0);
    assert.equal(keyset.defaultNegationProximity, 6);
    assert.equal(keyset.listNegationProximity, DEFAULT_LIST_NEGATION_PROXIMITY);
    assert.deepEqual(keyset.clauseBreakers, [...CLAUSE_BREAKERS]);
    assert.deepEqual(keyset.listCoordinators, [...LIST_COORDINATORS]);
    assert.deepEqual(keyset.sentenceTerminators, [".", "!", "?", ";", "\n"]);
    for (const e of keyset.entries) {
      assert.ok(e.token && e.matchType && Array.isArray(e.forms) && e.category);
      assert.ok(Array.isArray(e.allowedContexts));
    }
  });

  it("is in sync with the in-code registry (freshness contract)", () => {
    const codeTokens = COMPLIANCE_REGISTRY.map((e) => e.token).sort();
    const keysetTokens = keyset.entries.map((e) => e.token).sort();
    assert.deepEqual(keysetTokens, codeTokens);
  });
});
