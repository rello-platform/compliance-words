import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  LANE_REGISTRY,
  LANE_TOKEN_SET,
  listLaneEntries,
  scanLaneViolations,
  hasLaneViolation,
  checkCompliance,
} from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const tokensOf = (text, role, opts) =>
  scanLaneViolations(text, role, opts).map((v) => v.token).sort();

// ── (a) Lane registry — shape & completeness ────────────────────────────────
describe("lane registry — shape", () => {
  it("carries only the two lanes, every row valid", () => {
    for (const e of LANE_REGISTRY) {
      assert.equal(typeof e.token, "string", `${e.token}: token`);
      assert.ok(
        e.lane === "AGENT_LANE_VIOLATION" || e.lane === "MLO_LANE_VIOLATION",
        `${e.token}: lane`,
      );
      assert.ok(["word-stem", "phrase", "word"].includes(e.matchType), `${e.token}: matchType`);
      assert.ok(Array.isArray(e.forms) && e.forms.length > 0, `${e.token}: forms`);
      assert.ok(["HARD_BLOCK", "WARNING", "REVIEW_FLAG"].includes(e.severity), `${e.token}: severity`);
      assert.ok(Array.isArray(e.allowedContexts), `${e.token}: allowedContexts`);
      for (const c of e.allowedContexts) {
        assert.ok(["negation", "compound", "disclaimer-banner"].includes(c.kind), `${e.token}: ctx.kind`);
        assert.equal(typeof c.pattern, "string", `${e.token}: ctx.pattern`);
        assert.equal(typeof c.note, "string", `${e.token}: ctx.note`);
      }
      assert.equal(typeof e.rationale, "string", `${e.token}: rationale`);
      assert.ok(e.rationale.length > 0, `${e.token}: rationale non-empty`);
    }
  });

  it("DRAFT posture: every row defaults to WARNING (no HARD_BLOCK shipped armed)", () => {
    const armed = LANE_REGISTRY.filter((e) => e.severity === "HARD_BLOCK").map((e) => e.token);
    assert.deepEqual(armed, [], `no lane row may ship HARD_BLOCK by default; found: ${armed}`);
    for (const e of LANE_REGISTRY) assert.equal(e.severity, "WARNING", `${e.token}`);
  });

  it("token identities are unique", () => {
    assert.equal(LANE_TOKEN_SET.size, LANE_REGISTRY.length);
  });

  it("every row carries the negation + disclaimer-banner excusal contexts", () => {
    for (const e of LANE_REGISTRY) {
      const kinds = e.allowedContexts.map((c) => c.kind);
      assert.ok(kinds.includes("negation"), `${e.token}: negation`);
      assert.ok(kinds.includes("disclaimer-banner"), `${e.token}: disclaimer-banner`);
    }
  });

  it("listLaneEntries filters by lane", () => {
    const agent = listLaneEntries("AGENT_LANE_VIOLATION");
    const mlo = listLaneEntries("MLO_LANE_VIOLATION");
    assert.ok(agent.length > 0 && mlo.length > 0);
    assert.equal(agent.length + mlo.length, LANE_REGISTRY.length);
    assert.ok(agent.every((e) => e.lane === "AGENT_LANE_VIOLATION"));
    assert.ok(mlo.every((e) => e.lane === "MLO_LANE_VIOLATION"));
    assert.equal(listLaneEntries().length, LANE_REGISTRY.length);
  });
});

// ── (b) AGENT lane — MLO-only language flagged for an agent (positive) ───────
describe("AGENT lane — MLO-only language flagged for an agent", () => {
  const hits = [
    ["rate offer (possessive)", "Your rate will be 5.9% — apply now.", "rate offer"],
    ["rate offer (we can offer)", "We can offer you a rate of 6.1%.", "rate offer"],
    ["you qualify for a loan", "Great news — you qualify for a loan up to $400,000.", "you qualify for"],
    ["pre-approved for a mortgage", "Congrats, you are pre-approved for a mortgage!", "approved for a loan"],
    ["lock your rate", "Lock your rate today before it goes up!", "lock your rate"],
    ["refinance with me", "Refinance with me and save hundreds a month.", "refinance with me"],
    ["apply for a loan with me", "Apply for a loan with me today.", "apply for a loan with me"],
    ["recommend a loan product", "I recommend an FHA loan for your situation.", "recommend a loan product"],
    ["apr trigger term (payment)", "Your monthly payment will be low.", "apr trigger term"],
    ["apr trigger term (as low as)", "Rates as low as you'll find anywhere.", "apr trigger term"],
  ];
  for (const [label, text, token] of hits) {
    it(`flags: ${label}`, () => {
      assert.deepEqual(tokensOf(text, "AGENT"), [token], JSON.stringify(scanLaneViolations(text, "AGENT")));
      assert.equal(hasLaneViolation(text, "AGENT"), true);
    });
  }
});

// ── (c) AGENT lane — false-positive controls (must be CLEAN) ─────────────────
describe("AGENT lane — general market context is NOT flagged", () => {
  const clean = [
    ["general market rate cite", "Today's 30-year rates are around 6% per Freddie Mac."],
    ["rates dropping (education)", "When rates drop, refinancing may make sense — ask your loan officer."],
    ["seller approval (not a loan)", "Your offer was approved by the seller!"],
    ["HOA approval", "The HOA approved your application to paint the door."],
    ["naming loan types (no recommendation)", "FHA, VA, and conventional loans are all options your lender can explain."],
    ["lock the door (unrelated)", "Please lock the front door after the showing."],
    ["price lock (new construction, agent matter)", "The builder offered a price lock on the lot."],
    ["negated rate lock (referral)", "I am not your loan officer and cannot lock your rate — talk to your MLO."],
    ["non-loan qualification", "You qualify for a property-tax exemption this year."],
    ["bare educational apply", "When you're ready, you'll apply for a loan with your lender."],
  ];
  for (const [label, text] of clean) {
    it(`clean: ${label}`, () => {
      assert.deepEqual(scanLaneViolations(text, "AGENT"), [], JSON.stringify(scanLaneViolations(text, "AGENT")));
    });
  }
});

// ── (d) MLO lane — agent-only language flagged for an MLO (positive) ─────────
describe("MLO lane — agent-only language flagged for an MLO", () => {
  const hits = [
    ["list your home with me", "List your home with me this spring.", "list your home with me"],
    ["I'll sell your home", "I will sell your home fast.", "i'll sell your home"],
    ["I'm your real estate agent", "As your real estate agent, I'll guide you.", "i'm your real estate agent"],
    ["let me show you homes", "Let me show you homes this weekend.", "let me show you homes"],
    ["my listings", "Check out my listings!", "my listings"],
    ["my new listing (property singular)", "My new listing just hit the market.", "my listings"],
    ["free CMA (listing solicitation)", "Get your free CMA today.", "free cma to list"],
    ["represent you in the purchase", "I can represent you in the purchase.", "represent you in the purchase or sale"],
  ];
  for (const [label, text, token] of hits) {
    it(`flags: ${label}`, () => {
      assert.deepEqual(tokensOf(text, "MLO"), [token], JSON.stringify(scanLaneViolations(text, "MLO")));
      assert.equal(hasLaneViolation(text, "MLO"), true);
    });
  }
});

// ── (e) MLO lane — false-positive controls (must be CLEAN) ───────────────────
describe("MLO lane — general market context is NOT flagged", () => {
  const clean = [
    ["market education (selling fast)", "Homes are selling quickly in your area."],
    ["naming the OTHER professional", "Your real estate agent can help you list your home."],
    ["CMA defined educationally", "A comparative market analysis (CMA) estimates your home's value."],
    ["sell-your-home as loan context", "When you sell your home, the proceeds can pay off your loan."],
    ["my listing of documents (list-of-items sense)", "Here is my listing of the documents we need for your loan."],
    ["MLS listings (no possessive)", "There are many listings on the MLS right now."],
    ["negated agent claim", "I am not your real estate agent — I am your loan officer."],
    ["agent's listings (not mine)", "Your agent's listings are worth a look."],
  ];
  for (const [label, text] of clean) {
    it(`clean: ${label}`, () => {
      assert.deepEqual(scanLaneViolations(text, "MLO"), [], JSON.stringify(scanLaneViolations(text, "MLO")));
    });
  }
});

// ── (f) Role isolation — a phrase is only out-of-lane for the WRONG role ─────
describe("role isolation", () => {
  it("MLO-lane phrase under AGENT role is clean (it's IN the agent's lane to avoid? no — it's the MLO's to avoid)", () => {
    // "list your home with me" is an MLO_LANE_VIOLATION (agent-only language).
    // An AGENT may say it; only an MLO may not. So AGENT role → clean.
    assert.deepEqual(scanLaneViolations("List your home with me.", "AGENT"), []);
  });
  it("agent-lane phrase under MLO role is clean", () => {
    // "lock your rate" is an AGENT_LANE_VIOLATION (MLO-only language). An MLO may
    // say it; only an agent may not. So MLO role → clean.
    assert.deepEqual(scanLaneViolations("Lock your rate today.", "MLO"), []);
  });
  it("a mixed string flags only the role-appropriate lane", () => {
    const mixed = "List your home with me and lock your rate.";
    assert.deepEqual(tokensOf(mixed, "AGENT"), ["lock your rate"]);
    assert.deepEqual(tokensOf(mixed, "MLO"), ["list your home with me"]);
  });
});

// ── (g) DUAL role decision — skip lane checks ────────────────────────────────
describe("DUAL role", () => {
  it("returns [] — a dual-licensee may speak in either lane (documented decision)", () => {
    const mixed = "List your home with me and lock your rate.";
    assert.deepEqual(scanLaneViolations(mixed, "DUAL"), []);
    assert.equal(hasLaneViolation(mixed, "DUAL"), false);
  });
});

// ── (h) Unknown role — fail-safe-strict (BOTH lanes) ─────────────────────────
describe("unknown role — fail-safe-strict", () => {
  it("an unrecognized role applies BOTH lanes (strictest, not silent-skip)", () => {
    const mixed = "List your home with me and lock your rate.";
    // @ts-expect-error intentionally invalid role at the boundary
    assert.deepEqual(tokensOf(mixed, "BOGUS"), ["list your home with me", "lock your rate"]);
  });
});

// ── (i) Severity — default WARNING + floor can only RAISE ────────────────────
describe("severity", () => {
  it("defaults to WARNING", () => {
    assert.deepEqual(scanLaneViolations("Lock your rate today.", "AGENT").map((v) => v.severity), ["WARNING"]);
  });
  it("severityFloor raises to HARD_BLOCK when a consumer arms it", () => {
    const v = scanLaneViolations("Lock your rate today.", "AGENT", { severityFloor: "HARD_BLOCK" });
    assert.deepEqual(v.map((x) => x.severity), ["HARD_BLOCK"]);
  });
  it("severityFloor never LOWERS below the row default", () => {
    const v = scanLaneViolations("Lock your rate today.", "AGENT", { severityFloor: "REVIEW_FLAG" });
    assert.deepEqual(v.map((x) => x.severity), ["WARNING"]);
  });
});

// ── (j) Negation + disclaimer-banner excusal (mirrors M7) ────────────────────
describe("excusal contexts", () => {
  it("a negated wrong-lane phrase is excused", () => {
    assert.deepEqual(scanLaneViolations("I cannot lock your rate — your MLO does.", "AGENT"), []);
    assert.deepEqual(scanLaneViolations("I am not your real estate agent.", "MLO"), []);
  });
  it("an UNMARKED referral block flags (fail-safe-strict); the SAME block marked as a disclaimer passes", () => {
    const ref = "For loan questions, your loan officer can help you apply for a loan with me.";
    assert.deepEqual(tokensOf(ref, "AGENT"), ["apply for a loan with me"]);
    assert.deepEqual(scanLaneViolations(ref, "AGENT", { disclaimerRanges: [[0, ref.length]] }), []);
  });
});

// ── (k) Word boundaries / HTML (inherited from the shared engine) ────────────
describe("shared-engine behaviors carry to lanes", () => {
  it("catches a wrong-lane phrase wrapped in HTML tags", () => {
    assert.deepEqual(tokensOf("<b>Lock your rate</b> now!", "AGENT"), ["lock your rate"]);
  });
  it("ignores a phrase inside an HTML attribute/URL", () => {
    assert.deepEqual(scanLaneViolations('<a href="https://x.com/lock-your-rate">info</a>', "AGENT"), []);
  });
});

// ── (l) Degenerate input (no throw) ──────────────────────────────────────────
describe("degenerate input", () => {
  it("returns [] for empty/undefined/null/non-string", () => {
    assert.deepEqual(scanLaneViolations("", "AGENT"), []);
    assert.deepEqual(scanLaneViolations(undefined, "AGENT"), []);
    assert.deepEqual(scanLaneViolations(null, "MLO"), []);
    assert.deepEqual(scanLaneViolations(12345, "MLO"), []);
    assert.equal(hasLaneViolation("", "AGENT"), false);
  });
});

// ── (m) Orthogonality with M7 — lane and M7 are independent gates ────────────
describe("lane vs M7 orthogonality", () => {
  it("a string can be M7-clean yet cross-lane", () => {
    // "I'll sell your home" carries no M7 token but is agent-only language.
    assert.deepEqual([...checkCompliance("I will sell your home fast.")], []);
    assert.deepEqual(tokensOf("I will sell your home fast.", "MLO"), ["i'll sell your home"]);
  });
  it("the lane checker never returns M7 tokens and vice versa", () => {
    const text = "Lock your rate today.";
    // M7 flags the bare 'lock' stem; the lane checker flags the 'lock your rate' phrase.
    assert.ok(checkCompliance(text).some((v) => v.token === "lock"));
    assert.ok(scanLaneViolations(text, "AGENT").every((v) => v.token !== "lock"));
  });
});

// ── (n) Cross-language keyset carries the lane block ─────────────────────────
describe("dist/compliance-words-keyset.json — lane block", () => {
  const keyset = JSON.parse(readFileSync(join(root, "dist", "compliance-words-keyset.json"), "utf8"));

  it("carries laneEntries in sync with the in-code registry", () => {
    assert.ok(Array.isArray(keyset.laneEntries));
    const codeTokens = LANE_REGISTRY.map((e) => e.token).sort();
    const keysetTokens = keyset.laneEntries.map((e) => e.token).sort();
    assert.deepEqual(keysetTokens, codeTokens);
  });

  it("carries the DRAFT laneConfig (warn-only, unarmed) + role→lane map", () => {
    assert.equal(keyset.laneConfig.status, "DRAFT");
    assert.equal(keyset.laneConfig.defaultSeverity, "WARNING");
    assert.equal(keyset.laneConfig.armed, false);
    assert.deepEqual(keyset.laneConfig.roleLaneMap.AGENT, ["AGENT_LANE_VIOLATION"]);
    assert.deepEqual(keyset.laneConfig.roleLaneMap.MLO, ["MLO_LANE_VIOLATION"]);
    assert.deepEqual(keyset.laneConfig.roleLaneMap.DUAL, []);
  });

  it("each lane entry ships the fields the Python consumer needs", () => {
    for (const e of keyset.laneEntries) {
      assert.ok(e.token && e.lane && e.matchType && Array.isArray(e.forms) && e.severity);
      assert.ok(Array.isArray(e.allowedContexts));
      assert.equal(typeof e.rationale, "string");
    }
  });

  it("does NOT disturb the M7 entries block (additive)", () => {
    assert.equal(keyset.entries.length, 11);
    assert.equal(keyset.version, "0.1.2");
  });
});
