"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  CLAUSE_BREAKERS: () => CLAUSE_BREAKERS,
  COMPLIANCE_REGISTRY: () => COMPLIANCE_REGISTRY,
  COMPLIANCE_TOKEN_SET: () => COMPLIANCE_TOKEN_SET,
  DEFAULT_LIST_NEGATION_PROXIMITY: () => DEFAULT_LIST_NEGATION_PROXIMITY,
  DEFAULT_NEGATION_PROXIMITY: () => DEFAULT_NEGATION_PROXIMITY,
  LIST_COORDINATORS: () => LIST_COORDINATORS,
  NEGATION_CUES: () => NEGATION_CUES,
  checkCompliance: () => checkCompliance,
  hasHardBlock: () => hasHardBlock,
  listComplianceEntries: () => listComplianceEntries
});
module.exports = __toCommonJS(index_exports);

// src/registry/index.ts
var NEGATION_CUES = [
  "not",
  "no",
  "never",
  "cannot",
  "without",
  "nor",
  "neither",
  // contracted forms (the apostrophe is normalized to a straight ' before match)
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "won't",
  "can't",
  "don't",
  "doesn't",
  "didn't",
  "wouldn't",
  "shouldn't",
  "couldn't"
];
var DEFAULT_NEGATION_PROXIMITY = 6;
var DEFAULT_LIST_NEGATION_PROXIMITY = 18;
var CLAUSE_BREAKERS = [
  "so",
  "but",
  "because",
  "therefore",
  "thus",
  "then",
  "however",
  "meanwhile",
  "while",
  "although",
  "though",
  "yet",
  "since",
  "unless",
  "whereas"
];
var LIST_COORDINATORS = ["or", "nor"];
var NEGATION = {
  kind: "negation",
  pattern: "negation cue (not|never|no|isn't|won't\u2026) within proximity words before the match, same sentence",
  proximity: DEFAULT_NEGATION_PROXIMITY,
  note: "Affirmative-claim rule: the token is forbidden only as an affirmative claim. A negated/NOT-THAT use ('not a guarantee', 'this is not an approval') is compliant. Proven by the 7 live ACTIVE HecmContent rows (spec S3) whose forbidden tokens sit only inside NOT-THAT lines."
};
var DISCLAIMER = {
  kind: "disclaimer-banner",
  pattern: "match offset within a caller-supplied disclaimerRanges block",
  note: "Illustrative/disclaimer banners (Report-Engine ILLUSTRATIVE_BANNER 'Illustrative \u2014 not a loan offer, quote, or approval.'; Rello illustrative banners) legitimately name the forbidden tokens inside a clearly-marked disclaimer. The caller marks the range; fail-safe-strict if it does not (an unmarked banner HARD_BLOCKs)."
};
var COMPLIANCE_REGISTRY = [
  {
    token: "guarantee",
    matchType: "word-stem",
    forms: ["guarantee", "guaranteed", "guarantees", "guaranteeing"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "guarantee fee",
        note: "The named loan-program 'guarantee fee' (USDA upfront/annual guarantee fee, '0.35% annual guarantee fee') is a real fee term, not an advertising claim. Broadened from 'usda guarantee fee' to cover the abbreviated/annual label uses found in live Report-Engine template copy (m7-baseline DOMAIN_COMPOUND_SOT_GAP, pfp_prequal_summary:150)."
      },
      {
        kind: "compound",
        pattern: "mip / guarantee",
        note: "The scenario-comparison column label 'MIP / Guarantee' (mortgage-insurance-premium vs. USDA guarantee-fee row). Live Report-Engine template label (m7-baseline DOMAIN_COMPOUND_SOT_GAP, pfp_scenario_comparison:187)."
      },
      {
        kind: "compound",
        pattern: "loan guarantee program",
        note: "Named government program (e.g. VA/USDA loan guarantee program)."
      },
      {
        kind: "compound",
        pattern: "guarantee of value",
        note: "'not a guarantee of value' appraisal/disclosure phrasing."
      },
      NEGATION,
      DISCLAIMER
    ],
    suggest: "designed to / built to",
    provenance: ["S1", "S4", "S5", "S6", "RE"]
  },
  {
    token: "free money",
    matchType: "phrase",
    forms: ["free money"],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION],
    suggest: "no-cost / lender credit (if accurate)",
    provenance: ["S1", "S4", "S6", "RE"]
  },
  {
    token: "won't lose your home",
    matchType: "phrase",
    forms: ["won't lose your home", "will not lose your home"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "negation",
        pattern: "objection-handler / negation line",
        proximity: DEFAULT_NEGATION_PROXIMITY,
        note: `Objection-handler copy ('a common worry is you "won't lose your home" \u2014 here's the reality\u2026') frames it as a cited fear, not an affirmative promise.`
      },
      DISCLAIMER
    ],
    suggest: "(rephrase as a factual non-recourse explanation)",
    provenance: ["S1", "S3", "RE"]
  },
  {
    token: "approval",
    matchType: "word-stem",
    forms: ["approval", "approvals", "approved", "approve", "approves", "approving"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "hud-approved",
        note: "Named federal designation: a 'HUD-approved counselor' / 'HUD-approved housing counselor' / 'HUD-approved condominium' / 'HUD-approved counseling' is a real HUD status, NOT an advertising approval claim. The mandatory HECM HUD-counseling line carries it on every compliant message (live Rello HecmContent comp-hud-counseling-mandatory, obj-reverse-scams, hecm-v1 property-type rows; Milo HUD-counseling line; RE pfp_hecm_scenario_comparison:92,417). Closes DISCOVERED-MILO-COMPLIANCE-WORDS-HUD-APPROVED-COMPOUND-MISSING-260531."
      },
      {
        kind: "compound",
        pattern: "fha-approved",
        note: "Named federal designation: 'FHA-approved' / 'FHA/HUD-approved' condo/lender status, not an advertising claim (live Rello hecm-v1-card-property-type-eligibility:402, hecm-v1-fcn-property-type:309)."
      },
      {
        kind: "compound",
        pattern: "hud's approved list",
        note: "Reference to HUD's published list of approved condominium projects \u2014 a domain artifact, not a borrower approval claim (live Rello hecm-v1-card-property-type-eligibility:523, hecm-v1-fcn-property-type:424)."
      },
      {
        kind: "compound",
        pattern: "single-unit approval",
        note: "FHA Single-Unit Approval (SUA) \u2014 a named condominium-eligibility process, not a borrower approval claim (live Rello hecm-v1-card-property-type-eligibility:561)."
      },
      {
        kind: "compound",
        pattern: "condo approval",
        note: "FHA/HUD condominium-project approval process (the 'condo-approval field'), a named eligibility step, not a borrower approval claim (live Rello hecm-v1-fcn-property-type:474)."
      },
      NEGATION,
      DISCLAIMER
    ],
    suggest: "review / pre-eligibility (if accurate)",
    provenance: ["S1", "S2", "S3", "RE"]
  },
  {
    token: "lock",
    matchType: "word-stem",
    forms: ["lock", "locked", "locks", "locking"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "rate-lock confirmation",
        note: "Named post-event transactional step (CLOSING_RELEVANT_TYPES `rate_lock_confirmation`); legitimate after a real lock."
      },
      {
        kind: "compound",
        pattern: "rate lock",
        note: "'rate lock' as a named product step in transactional/closing copy (post-event), not an affirmative pre-event claim."
      },
      {
        kind: "compound",
        pattern: "lock days",
        note: "The rate-lock-period column label 'Lock days' in scenario-comparison copy \u2014 a transactional field, not an affirmative lock claim (live Report-Engine pfp_scenario_comparison:359)."
      },
      NEGATION
    ],
    suggest: "secure your rate (after a real lock)",
    provenance: ["S1", "S3", "RE"]
  },
  {
    token: "quote",
    matchType: "word-stem",
    forms: ["quote", "quoted", "quotes", "quoting"],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "estimate / illustration",
    provenance: ["S1", "S2", "S3", "RE"]
  },
  {
    // Gap 2 (v0.1.1): the bare `offer` stem false-blocked ordinary English —
    // "offer to include the family", "your real offered rate", "the MLO's offered
    // HECM rate", "record it when offered", "more trust than you could offer"
    // (live Rello fcn-expected-rate, hecm-v1-fcn-family-involved,
    // hecm-v1-fcn-trusted-contact-phone, obj-reverse-scams; RE
    // pfp_hecm_scenario_comparison:624). The PROHIBITED sense is the promotional
    // marketing collocation, not the verb/participle. So `offer` is narrowed from
    // a word-stem to a PHRASE that matches only the marketing collocations
    // (chosen mechanism (a) of the dispatch's Gap-2 options): ordinary verb/
    // participle uses now pass cleanly, while "limited-time offer" / "special
    // offer" / "offer expires" still HARD_BLOCK. Residual (documented): a bare
    // promotional NOUN with no qualifier ("here's our offer") is no longer caught
    // — acceptable, since such copy is rare and the unambiguous claim collocations
    // remain blocked.
    token: "offer",
    matchType: "phrase",
    forms: [
      "special offer",
      "exclusive offer",
      "limited offer",
      "limited-time offer",
      "limited time offer",
      "one-time offer",
      "one time offer",
      "best offer",
      "offer expires",
      "offer ends",
      "offer ends soon",
      "act now offer"
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "option / scenario",
    provenance: ["S1", "S3", "RE"]
  },
  {
    token: "pre-qualified",
    matchType: "word-stem",
    forms: [
      "pre-qualified",
      "pre-qualify",
      "pre-qualifies",
      "pre-qualifying",
      "pre-qualification",
      "prequalified",
      "prequalify",
      "prequalification"
    ],
    category: "HARD_BLOCK",
    // Gap 3 (v0.1.1): added DISCLAIMER so a caller-marked illustrative/disclaimer
    // block naming 'pre-qualification' inside a NOT-THAT line passes, matching the
    // posture of approval/quote (P3 finding). NOTE: an AFFIRMATIVE product-identity
    // use ("Pre-Qualification Summary" title, "is pre-qualified") is deliberately
    // NOT excused here — that is a Kelly product-policy call left OPEN (RE
    // pfp_prequal_summary PRODUCT_JUDGMENT_SURFACED trips; see PR body HALT note).
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "explore your options",
    provenance: ["S2"]
  },
  {
    token: "risk-free",
    matchType: "phrase",
    forms: ["risk-free", "risk free"],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION],
    suggest: "(delete \u2014 no compliant substitute)",
    provenance: ["S5"]
  },
  {
    token: "final",
    matchType: "word-stem",
    forms: ["final", "finals"],
    category: "REVIEW_FLAG",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "final disclosure",
        note: "TRID 'Final Disclosure' / 'Closing Disclosure' is a named legal document."
      },
      {
        kind: "compound",
        pattern: "final tila",
        note: "'Final TILA' is a named legal disclosure."
      },
      {
        kind: "compound",
        pattern: "final walkthrough",
        note: "'final walkthrough' is a named closing step."
      },
      NEGATION
    ],
    suggest: "(human review)",
    provenance: ["S3"]
  },
  {
    token: "AI",
    matchType: "word",
    forms: ["AI"],
    category: "HARD_BLOCK",
    allowedContexts: [
      {
        kind: "compound",
        pattern: "open ai",
        note: "External proper noun (OpenAI). Belt-and-suspenders \u2014 the case-sensitive whole-word match already skips 'OpenAI' (no word boundary before 'AI')."
      },
      {
        kind: "compound",
        pattern: "google ai",
        note: "External proper noun (a named third-party product, not a description of Milo)."
      },
      {
        kind: "compound",
        pattern: "microsoft ai",
        note: "External proper noun (a named third-party product)."
      },
      {
        kind: "compound",
        pattern: "meta ai",
        note: "External proper noun (a named third-party product)."
      }
    ],
    suggest: "Smart Assistant",
    provenance: ["CLAUDE.md", "S1", "S2", "RE"]
  }
];
var COMPLIANCE_TOKEN_SET = new Set(
  COMPLIANCE_REGISTRY.map((entry) => entry.token)
);
function listComplianceEntries() {
  return COMPLIANCE_REGISTRY;
}

// src/check.ts
var WORD_CHAR = "A-Za-z0-9";
var BOUNDARY_BEFORE = `(?<![${WORD_CHAR}])`;
var BOUNDARY_AFTER = `(?![${WORD_CHAR}])`;
var SEP = `[^${WORD_CHAR}]+`;
var SENTENCE_TERMINATOR = /[.!?;\n]/;
var NEGATION_SET = new Set(NEGATION_CUES);
var CLAUSE_BREAKER_SET = new Set(CLAUSE_BREAKERS);
var LIST_COORDINATOR_SET = new Set(LIST_COORDINATORS);
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeApostrophe(s) {
  return s.replace(/[‘’ʼ]/g, "'");
}
function compilePhrasePattern(phrase) {
  let out = BOUNDARY_BEFORE;
  let pendingSep = false;
  for (const ch of phrase) {
    if (/[A-Za-z0-9]/.test(ch)) {
      if (pendingSep) {
        out += SEP;
        pendingSep = false;
      }
      out += escapeRegex(ch);
    } else if (ch === "'" || ch === "\u2019" || ch === "\u2018") {
      out += "['\u2018\u2019]?";
    } else {
      pendingSep = true;
    }
  }
  return out + BOUNDARY_AFTER;
}
function compileFormPattern(form, matchType) {
  if (matchType === "phrase") return compilePhrasePattern(form);
  return BOUNDARY_BEFORE + escapeRegex(form) + BOUNDARY_AFTER;
}
var COMPILED = COMPLIANCE_REGISTRY.map((entry) => {
  const caseSensitive = entry.matchType === "word";
  const flags = caseSensitive ? "g" : "gi";
  const tokenPattern = entry.forms.map((f) => compileFormPattern(f, entry.matchType)).join("|");
  const compoundRegexes = entry.allowedContexts.filter((c) => c.kind === "compound").map((c) => new RegExp(compilePhrasePattern(c.pattern), "gi"));
  const negation = entry.allowedContexts.find((c) => c.kind === "negation");
  return {
    entry,
    tokenRegex: new RegExp(tokenPattern, flags),
    compoundRegexes,
    hasNegation: Boolean(negation),
    negationProximity: negation?.proximity ?? DEFAULT_NEGATION_PROXIMITY,
    listNegationProximity: DEFAULT_LIST_NEGATION_PROXIMITY,
    hasDisclaimer: entry.allowedContexts.some((c) => c.kind === "disclaimer-banner")
  };
});
function maskHtml(text) {
  return text.replace(/<[^>]*>/g, (m) => " ".repeat(m.length));
}
function indexWords(masked) {
  const words = [];
  const re = /[A-Za-z0-9'‘’]+/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    words.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return words;
}
function wordIndexForMatch(words, offset) {
  for (let i = 0; i < words.length; i++) {
    if (offset < words[i].end) return i;
  }
  return words.length;
}
function isNegated(masked, words, matchOffset, proximity, listProximity) {
  const w = wordIndexForMatch(words, matchOffset);
  let sawCoordinator = false;
  const floor = Math.max(0, w - listProximity);
  for (let j = w - 1; j >= floor; j--) {
    const next = words[j + 1];
    const rightEdge = next ? next.start : matchOffset;
    const gap = masked.slice(words[j].end, rightEdge);
    if (SENTENCE_TERMINATOR.test(gap)) break;
    if (gap.includes(",")) sawCoordinator = true;
    const cue = normalizeApostrophe(words[j].text.toLowerCase()).replace(/^'+|'+$/g, "");
    if (CLAUSE_BREAKER_SET.has(cue)) break;
    if (NEGATION_SET.has(cue)) {
      const dist = w - j;
      if (dist <= proximity) return true;
      if (sawCoordinator) return true;
      break;
    }
    if (LIST_COORDINATOR_SET.has(cue)) sawCoordinator = true;
  }
  return false;
}
function withinAnyRange(offset, ranges) {
  if (!ranges) return false;
  return ranges.some(([start, end]) => offset >= start && offset < end);
}
function withinAnyCompound(offset, spans) {
  return spans.some(([start, end]) => offset >= start && offset < end);
}
function buildMessage(entry, matchedText, index) {
  const base = `\u2717 ${entry.category}: "${matchedText}" is M7 prohibited language ("${entry.token}") at offset ${index}`;
  return entry.suggest ? `${base} \u2192 use "${entry.suggest}" instead` : base;
}
function checkCompliance(text, opts = {}) {
  if (typeof text !== "string" || text.length === 0) return [];
  const masked = maskHtml(text);
  const words = indexWords(masked);
  const violations = [];
  for (const compiled of COMPILED) {
    const compoundSpans = [];
    for (const cre of compiled.compoundRegexes) {
      cre.lastIndex = 0;
      let cm;
      while ((cm = cre.exec(masked)) !== null) {
        compoundSpans.push([cm.index, cm.index + cm[0].length]);
        if (cm.index === cre.lastIndex) cre.lastIndex++;
      }
    }
    compiled.tokenRegex.lastIndex = 0;
    let m;
    while ((m = compiled.tokenRegex.exec(masked)) !== null) {
      const index = m.index;
      const matchedText = text.slice(index, index + m[0].length);
      if (compiled.tokenRegex.lastIndex === index) compiled.tokenRegex.lastIndex++;
      if (withinAnyCompound(index, compoundSpans)) continue;
      if (compiled.hasDisclaimer && withinAnyRange(index, opts.disclaimerRanges)) continue;
      if (compiled.hasNegation && isNegated(masked, words, index, compiled.negationProximity, compiled.listNegationProximity)) {
        continue;
      }
      violations.push({
        token: compiled.entry.token,
        category: compiled.entry.category,
        index,
        matchedText,
        suggest: compiled.entry.suggest,
        message: buildMessage(compiled.entry, matchedText, index)
      });
    }
  }
  violations.sort((a, b) => a.index - b.index || a.token.localeCompare(b.token));
  if (opts.categories) {
    const allow = new Set(opts.categories);
    return violations.filter((v) => allow.has(v.category));
  }
  return violations;
}
function hasHardBlock(text, opts = {}) {
  return checkCompliance(text, { ...opts, categories: ["HARD_BLOCK"] }).length > 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CLAUSE_BREAKERS,
  COMPLIANCE_REGISTRY,
  COMPLIANCE_TOKEN_SET,
  DEFAULT_LIST_NEGATION_PROXIMITY,
  DEFAULT_NEGATION_PROXIMITY,
  LIST_COORDINATORS,
  NEGATION_CUES,
  checkCompliance,
  hasHardBlock,
  listComplianceEntries
});
//# sourceMappingURL=index.cjs.map