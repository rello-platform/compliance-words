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
      assert.ok(e.forms.includes(e.token), `${e.token}: forms must include the canonical token`);
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
  const banner = "Illustrative scenario: an example offer and quote shown for comparison.";

  it("an UNMARKED illustrative block HARD_BLOCKs (fail-safe-strict)", () => {
    assert.equal(hasHardBlock(banner), true);
    assert.deepEqual(tokensOf(banner), ["offer", "quote"]);
  });

  it("the SAME block marked as a disclaimer range passes", () => {
    assert.deepEqual(checkCompliance(banner, { disclaimerRanges: [[0, banner.length]] }), []);
  });

  it("guarantee is NOT disclaimer-exemptible (no disclaimer-banner context)", () => {
    const t = "Illustrative: we guarantee this rate.";
    // even marked as a disclaimer range, guarantee still blocks (entry has no
    // disclaimer-banner allowance — only negation/compound).
    assert.deepEqual(tokensOf(t, { disclaimerRanges: [[0, t.length]] }), ["guarantee"]);
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

// ── (k) Cross-language keyset (committed dist artifact) ──────────────────────
describe("dist/compliance-words-keyset.json", () => {
  const keyset = JSON.parse(
    readFileSync(join(root, "dist", "compliance-words-keyset.json"), "utf8"),
  );

  it("names the package + version and carries all 11 entries", () => {
    assert.equal(keyset.package, "@rello-platform/compliance-words");
    assert.equal(keyset.version, "0.1.0");
    assert.equal(keyset.entries.length, 11);
  });

  it("carries the full matcher config the Python consumer needs", () => {
    assert.ok(Array.isArray(keyset.negationCues) && keyset.negationCues.length > 0);
    assert.equal(keyset.defaultNegationProximity, 6);
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
