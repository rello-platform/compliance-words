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
  LANE_REGISTRY: () => LANE_REGISTRY,
  LANE_TOKEN_SET: () => LANE_TOKEN_SET,
  LIST_COORDINATORS: () => LIST_COORDINATORS,
  NEGATION_CUES: () => NEGATION_CUES,
  RATE_CLAIM_CONFIG: () => RATE_CLAIM_CONFIG,
  checkCompliance: () => checkCompliance,
  classifyPercentFigures: () => classifyPercentFigures,
  hasHardBlock: () => hasHardBlock,
  hasLaneViolation: () => hasLaneViolation,
  hasRateClaimViolation: () => hasRateClaimViolation,
  listComplianceEntries: () => listComplianceEntries,
  listLaneEntries: () => listLaneEntries,
  scanLaneViolations: () => scanLaneViolations,
  scanRateClaims: () => scanRateClaims
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
    // Gap-3 allow-by-default inversion (v0.6.0, Kelly 2026-07-06): the bare
    // `approval` word-stem HARD_BLOCKed ordinary conditional/procedural approval
    // language ("get pre-approved", "subject to underwriting approval", "once
    // approved by underwriting", "pending approval") — the exact institutional
    // GATE copy compliance WANTS. Inverted to allow-by-default: `approval` is now
    // a PHRASE that matches ONLY the affirmative-claim collocations. The
    // you're/you've-been pre-approved family is REQUIRED-blocked because a
    // definitive pre-approval statement to a consumer is an FCRA firm offer of
    // credit.
    token: "approval",
    matchType: "phrase",
    forms: [
      "you're approved",
      "you are approved",
      "you've been approved",
      "you have been approved",
      "get approved",
      "get you approved",
      "i'll get you approved",
      "instant approval",
      "guaranteed approval",
      "immediate approval",
      "fast approval",
      "approved today",
      "approved now",
      "approved in minutes",
      "you're pre-approved",
      "you are pre-approved",
      "you've been pre-approved",
      "you have been pre-approved"
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "review / pre-eligibility (if accurate)",
    provenance: [
      "S1",
      "S2",
      "S3",
      "RE",
      "Gap-3 allow-by-default inversion 2026-07-06; affirmative-claim collocations only; conditional/procedural approval language (get pre-approved, subject to underwriting approval, once approved by underwriting, pending approval) now passes; you're/you've-been pre-approved kept blocked = FCRA firm-offer."
    ]
  },
  {
    // Gap-3 allow-by-default inversion (v0.6.0): the bare `lock` word-stem
    // false-blocked every named post-event product step ("rate lock", "lock
    // period", "once we lock"). Inverted to a PHRASE matching only the
    // affirmative pre-event rate-lock CTA.
    token: "lock",
    matchType: "phrase",
    forms: [
      "lock your rate",
      "lock in your rate",
      "lock your rate today",
      "lock in today",
      "rates locked in for you",
      "lock in your savings"
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION],
    suggest: "secure your rate (after a real lock)",
    provenance: [
      "S1",
      "S3",
      "RE",
      "Gap-3 inversion; affirmative pre-event rate-lock CTA only; rate lock / lock period / once we lock now pass."
    ]
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
    // Gap-3 allow-by-default inversion (v0.6.0): narrowed from a word-stem to a
    // PHRASE matching only the affirmative claim ("you're pre-qualified"). The
    // procedural CTA "get pre-qualified" and the product-name noun ("the
    // pre-qualification summary") now pass without needing compound allowances.
    token: "pre-qualified",
    matchType: "phrase",
    forms: [
      "you're pre-qualified",
      "you are pre-qualified",
      "you've been pre-qualified",
      "you have been pre-qualified",
      "instant pre-qualification",
      "guaranteed pre-qualification"
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "explore your options",
    provenance: [
      "S2",
      "Gap-3 inversion; affirmative claim only; get pre-qualified / the pre-qualification summary now pass."
    ]
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
  },
  {
    // Gap-3 new deny class (v0.6.0). Reg-Z: the same rate-stability promise as a
    // rate lock, made via a synonym ("freeze"/"hold") before any real lock event.
    token: "rate-freeze",
    matchType: "phrase",
    forms: [
      "freeze your rate",
      "rate freeze",
      "hold your rate",
      "rate hold",
      "freeze your savings",
      "freeze your payment"
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "secure your rate (after a real lock)",
    provenance: ["Gap-3 2026-07-06 new deny class; Reg-Z rate-stability promise via a lock synonym (freeze/hold)."]
  },
  {
    // Gap-3 new deny class (v0.6.0). Reg N / MAP Rule: an unqualified free/no-cost
    // claim. "no lender fees" is intentionally NOT a form (Kelly-approved as a
    // factual statement).
    token: "zero-cost",
    matchType: "phrase",
    forms: [
      "no-cost loan",
      "zero-cost mortgage",
      "free refinance",
      "no closing costs",
      "completely free",
      "no cost to you",
      "absolutely free"
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "low-cost / an estimate of costs",
    provenance: ["Gap-3 2026-07-06 new deny class; Reg N / MAP Rule unqualified free/no-cost claim ('no lender fees' excluded as factual)."]
  },
  {
    // Gap-3 new deny class (v0.6.0). MAP Rule: implying government origin or
    // endorsement of a private mortgage product.
    token: "gov-affiliation",
    matchType: "phrase",
    forms: [
      "official housing notice",
      "official government notice",
      "stimulus relief mortgage",
      "government approved program",
      "federal mortgage relief",
      "national rate directive"
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "name the specific program (FHA/VA/USDA) plainly",
    provenance: ["Gap-3 2026-07-06 new deny class; MAP Rule implying government origin/endorsement."]
  },
  {
    // Gap-3 new deny class (v0.6.0). UDAAP: fabricated urgency / false-deadline
    // pressure copy.
    token: "manufactured-urgency",
    matchType: "phrase",
    forms: [
      "final notice",
      "notice of eligibility",
      "enrollment deadline",
      "your window closes today",
      "expires at midnight",
      "act now before"
    ],
    category: "HARD_BLOCK",
    allowedContexts: [NEGATION, DISCLAIMER],
    suggest: "state a real product expiration plainly, or drop the deadline",
    provenance: ["Gap-3 2026-07-06 new deny class; UDAAP fabricated-urgency / false-deadline pressure."]
  }
];
var COMPLIANCE_TOKEN_SET = new Set(
  COMPLIANCE_REGISTRY.map((entry) => entry.token)
);
function listComplianceEntries() {
  return COMPLIANCE_REGISTRY;
}

// src/html-entities.ts
var HTML_NAMED_ENTITIES = /* @__PURE__ */ new Map([
  ["AElig", "\xC6"],
  ["AElig;", "\xC6"],
  ["AMP", "&"],
  ["AMP;", "&"],
  ["Aacute", "\xC1"],
  ["Aacute;", "\xC1"],
  ["Abreve;", "\u0102"],
  ["Acirc", "\xC2"],
  ["Acirc;", "\xC2"],
  ["Acy;", "\u0410"],
  ["Afr;", "\u{1D504}"],
  ["Agrave", "\xC0"],
  ["Agrave;", "\xC0"],
  ["Alpha;", "\u0391"],
  ["Amacr;", "\u0100"],
  ["And;", "\u2A53"],
  ["Aogon;", "\u0104"],
  ["Aopf;", "\u{1D538}"],
  ["ApplyFunction;", "\u2061"],
  ["Aring", "\xC5"],
  ["Aring;", "\xC5"],
  ["Ascr;", "\u{1D49C}"],
  ["Assign;", "\u2254"],
  ["Atilde", "\xC3"],
  ["Atilde;", "\xC3"],
  ["Auml", "\xC4"],
  ["Auml;", "\xC4"],
  ["Backslash;", "\u2216"],
  ["Barv;", "\u2AE7"],
  ["Barwed;", "\u2306"],
  ["Bcy;", "\u0411"],
  ["Because;", "\u2235"],
  ["Bernoullis;", "\u212C"],
  ["Beta;", "\u0392"],
  ["Bfr;", "\u{1D505}"],
  ["Bopf;", "\u{1D539}"],
  ["Breve;", "\u02D8"],
  ["Bscr;", "\u212C"],
  ["Bumpeq;", "\u224E"],
  ["CHcy;", "\u0427"],
  ["COPY", "\xA9"],
  ["COPY;", "\xA9"],
  ["Cacute;", "\u0106"],
  ["Cap;", "\u22D2"],
  ["CapitalDifferentialD;", "\u2145"],
  ["Cayleys;", "\u212D"],
  ["Ccaron;", "\u010C"],
  ["Ccedil", "\xC7"],
  ["Ccedil;", "\xC7"],
  ["Ccirc;", "\u0108"],
  ["Cconint;", "\u2230"],
  ["Cdot;", "\u010A"],
  ["Cedilla;", "\xB8"],
  ["CenterDot;", "\xB7"],
  ["Cfr;", "\u212D"],
  ["Chi;", "\u03A7"],
  ["CircleDot;", "\u2299"],
  ["CircleMinus;", "\u2296"],
  ["CirclePlus;", "\u2295"],
  ["CircleTimes;", "\u2297"],
  ["ClockwiseContourIntegral;", "\u2232"],
  ["CloseCurlyDoubleQuote;", "\u201D"],
  ["CloseCurlyQuote;", "\u2019"],
  ["Colon;", "\u2237"],
  ["Colone;", "\u2A74"],
  ["Congruent;", "\u2261"],
  ["Conint;", "\u222F"],
  ["ContourIntegral;", "\u222E"],
  ["Copf;", "\u2102"],
  ["Coproduct;", "\u2210"],
  ["CounterClockwiseContourIntegral;", "\u2233"],
  ["Cross;", "\u2A2F"],
  ["Cscr;", "\u{1D49E}"],
  ["Cup;", "\u22D3"],
  ["CupCap;", "\u224D"],
  ["DD;", "\u2145"],
  ["DDotrahd;", "\u2911"],
  ["DJcy;", "\u0402"],
  ["DScy;", "\u0405"],
  ["DZcy;", "\u040F"],
  ["Dagger;", "\u2021"],
  ["Darr;", "\u21A1"],
  ["Dashv;", "\u2AE4"],
  ["Dcaron;", "\u010E"],
  ["Dcy;", "\u0414"],
  ["Del;", "\u2207"],
  ["Delta;", "\u0394"],
  ["Dfr;", "\u{1D507}"],
  ["DiacriticalAcute;", "\xB4"],
  ["DiacriticalDot;", "\u02D9"],
  ["DiacriticalDoubleAcute;", "\u02DD"],
  ["DiacriticalGrave;", "`"],
  ["DiacriticalTilde;", "\u02DC"],
  ["Diamond;", "\u22C4"],
  ["DifferentialD;", "\u2146"],
  ["Dopf;", "\u{1D53B}"],
  ["Dot;", "\xA8"],
  ["DotDot;", "\u20DC"],
  ["DotEqual;", "\u2250"],
  ["DoubleContourIntegral;", "\u222F"],
  ["DoubleDot;", "\xA8"],
  ["DoubleDownArrow;", "\u21D3"],
  ["DoubleLeftArrow;", "\u21D0"],
  ["DoubleLeftRightArrow;", "\u21D4"],
  ["DoubleLeftTee;", "\u2AE4"],
  ["DoubleLongLeftArrow;", "\u27F8"],
  ["DoubleLongLeftRightArrow;", "\u27FA"],
  ["DoubleLongRightArrow;", "\u27F9"],
  ["DoubleRightArrow;", "\u21D2"],
  ["DoubleRightTee;", "\u22A8"],
  ["DoubleUpArrow;", "\u21D1"],
  ["DoubleUpDownArrow;", "\u21D5"],
  ["DoubleVerticalBar;", "\u2225"],
  ["DownArrow;", "\u2193"],
  ["DownArrowBar;", "\u2913"],
  ["DownArrowUpArrow;", "\u21F5"],
  ["DownBreve;", "\u0311"],
  ["DownLeftRightVector;", "\u2950"],
  ["DownLeftTeeVector;", "\u295E"],
  ["DownLeftVector;", "\u21BD"],
  ["DownLeftVectorBar;", "\u2956"],
  ["DownRightTeeVector;", "\u295F"],
  ["DownRightVector;", "\u21C1"],
  ["DownRightVectorBar;", "\u2957"],
  ["DownTee;", "\u22A4"],
  ["DownTeeArrow;", "\u21A7"],
  ["Downarrow;", "\u21D3"],
  ["Dscr;", "\u{1D49F}"],
  ["Dstrok;", "\u0110"],
  ["ENG;", "\u014A"],
  ["ETH", "\xD0"],
  ["ETH;", "\xD0"],
  ["Eacute", "\xC9"],
  ["Eacute;", "\xC9"],
  ["Ecaron;", "\u011A"],
  ["Ecirc", "\xCA"],
  ["Ecirc;", "\xCA"],
  ["Ecy;", "\u042D"],
  ["Edot;", "\u0116"],
  ["Efr;", "\u{1D508}"],
  ["Egrave", "\xC8"],
  ["Egrave;", "\xC8"],
  ["Element;", "\u2208"],
  ["Emacr;", "\u0112"],
  ["EmptySmallSquare;", "\u25FB"],
  ["EmptyVerySmallSquare;", "\u25AB"],
  ["Eogon;", "\u0118"],
  ["Eopf;", "\u{1D53C}"],
  ["Epsilon;", "\u0395"],
  ["Equal;", "\u2A75"],
  ["EqualTilde;", "\u2242"],
  ["Equilibrium;", "\u21CC"],
  ["Escr;", "\u2130"],
  ["Esim;", "\u2A73"],
  ["Eta;", "\u0397"],
  ["Euml", "\xCB"],
  ["Euml;", "\xCB"],
  ["Exists;", "\u2203"],
  ["ExponentialE;", "\u2147"],
  ["Fcy;", "\u0424"],
  ["Ffr;", "\u{1D509}"],
  ["FilledSmallSquare;", "\u25FC"],
  ["FilledVerySmallSquare;", "\u25AA"],
  ["Fopf;", "\u{1D53D}"],
  ["ForAll;", "\u2200"],
  ["Fouriertrf;", "\u2131"],
  ["Fscr;", "\u2131"],
  ["GJcy;", "\u0403"],
  ["GT", ">"],
  ["GT;", ">"],
  ["Gamma;", "\u0393"],
  ["Gammad;", "\u03DC"],
  ["Gbreve;", "\u011E"],
  ["Gcedil;", "\u0122"],
  ["Gcirc;", "\u011C"],
  ["Gcy;", "\u0413"],
  ["Gdot;", "\u0120"],
  ["Gfr;", "\u{1D50A}"],
  ["Gg;", "\u22D9"],
  ["Gopf;", "\u{1D53E}"],
  ["GreaterEqual;", "\u2265"],
  ["GreaterEqualLess;", "\u22DB"],
  ["GreaterFullEqual;", "\u2267"],
  ["GreaterGreater;", "\u2AA2"],
  ["GreaterLess;", "\u2277"],
  ["GreaterSlantEqual;", "\u2A7E"],
  ["GreaterTilde;", "\u2273"],
  ["Gscr;", "\u{1D4A2}"],
  ["Gt;", "\u226B"],
  ["HARDcy;", "\u042A"],
  ["Hacek;", "\u02C7"],
  ["Hat;", "^"],
  ["Hcirc;", "\u0124"],
  ["Hfr;", "\u210C"],
  ["HilbertSpace;", "\u210B"],
  ["Hopf;", "\u210D"],
  ["HorizontalLine;", "\u2500"],
  ["Hscr;", "\u210B"],
  ["Hstrok;", "\u0126"],
  ["HumpDownHump;", "\u224E"],
  ["HumpEqual;", "\u224F"],
  ["IEcy;", "\u0415"],
  ["IJlig;", "\u0132"],
  ["IOcy;", "\u0401"],
  ["Iacute", "\xCD"],
  ["Iacute;", "\xCD"],
  ["Icirc", "\xCE"],
  ["Icirc;", "\xCE"],
  ["Icy;", "\u0418"],
  ["Idot;", "\u0130"],
  ["Ifr;", "\u2111"],
  ["Igrave", "\xCC"],
  ["Igrave;", "\xCC"],
  ["Im;", "\u2111"],
  ["Imacr;", "\u012A"],
  ["ImaginaryI;", "\u2148"],
  ["Implies;", "\u21D2"],
  ["Int;", "\u222C"],
  ["Integral;", "\u222B"],
  ["Intersection;", "\u22C2"],
  ["InvisibleComma;", "\u2063"],
  ["InvisibleTimes;", "\u2062"],
  ["Iogon;", "\u012E"],
  ["Iopf;", "\u{1D540}"],
  ["Iota;", "\u0399"],
  ["Iscr;", "\u2110"],
  ["Itilde;", "\u0128"],
  ["Iukcy;", "\u0406"],
  ["Iuml", "\xCF"],
  ["Iuml;", "\xCF"],
  ["Jcirc;", "\u0134"],
  ["Jcy;", "\u0419"],
  ["Jfr;", "\u{1D50D}"],
  ["Jopf;", "\u{1D541}"],
  ["Jscr;", "\u{1D4A5}"],
  ["Jsercy;", "\u0408"],
  ["Jukcy;", "\u0404"],
  ["KHcy;", "\u0425"],
  ["KJcy;", "\u040C"],
  ["Kappa;", "\u039A"],
  ["Kcedil;", "\u0136"],
  ["Kcy;", "\u041A"],
  ["Kfr;", "\u{1D50E}"],
  ["Kopf;", "\u{1D542}"],
  ["Kscr;", "\u{1D4A6}"],
  ["LJcy;", "\u0409"],
  ["LT", "<"],
  ["LT;", "<"],
  ["Lacute;", "\u0139"],
  ["Lambda;", "\u039B"],
  ["Lang;", "\u27EA"],
  ["Laplacetrf;", "\u2112"],
  ["Larr;", "\u219E"],
  ["Lcaron;", "\u013D"],
  ["Lcedil;", "\u013B"],
  ["Lcy;", "\u041B"],
  ["LeftAngleBracket;", "\u27E8"],
  ["LeftArrow;", "\u2190"],
  ["LeftArrowBar;", "\u21E4"],
  ["LeftArrowRightArrow;", "\u21C6"],
  ["LeftCeiling;", "\u2308"],
  ["LeftDoubleBracket;", "\u27E6"],
  ["LeftDownTeeVector;", "\u2961"],
  ["LeftDownVector;", "\u21C3"],
  ["LeftDownVectorBar;", "\u2959"],
  ["LeftFloor;", "\u230A"],
  ["LeftRightArrow;", "\u2194"],
  ["LeftRightVector;", "\u294E"],
  ["LeftTee;", "\u22A3"],
  ["LeftTeeArrow;", "\u21A4"],
  ["LeftTeeVector;", "\u295A"],
  ["LeftTriangle;", "\u22B2"],
  ["LeftTriangleBar;", "\u29CF"],
  ["LeftTriangleEqual;", "\u22B4"],
  ["LeftUpDownVector;", "\u2951"],
  ["LeftUpTeeVector;", "\u2960"],
  ["LeftUpVector;", "\u21BF"],
  ["LeftUpVectorBar;", "\u2958"],
  ["LeftVector;", "\u21BC"],
  ["LeftVectorBar;", "\u2952"],
  ["Leftarrow;", "\u21D0"],
  ["Leftrightarrow;", "\u21D4"],
  ["LessEqualGreater;", "\u22DA"],
  ["LessFullEqual;", "\u2266"],
  ["LessGreater;", "\u2276"],
  ["LessLess;", "\u2AA1"],
  ["LessSlantEqual;", "\u2A7D"],
  ["LessTilde;", "\u2272"],
  ["Lfr;", "\u{1D50F}"],
  ["Ll;", "\u22D8"],
  ["Lleftarrow;", "\u21DA"],
  ["Lmidot;", "\u013F"],
  ["LongLeftArrow;", "\u27F5"],
  ["LongLeftRightArrow;", "\u27F7"],
  ["LongRightArrow;", "\u27F6"],
  ["Longleftarrow;", "\u27F8"],
  ["Longleftrightarrow;", "\u27FA"],
  ["Longrightarrow;", "\u27F9"],
  ["Lopf;", "\u{1D543}"],
  ["LowerLeftArrow;", "\u2199"],
  ["LowerRightArrow;", "\u2198"],
  ["Lscr;", "\u2112"],
  ["Lsh;", "\u21B0"],
  ["Lstrok;", "\u0141"],
  ["Lt;", "\u226A"],
  ["Map;", "\u2905"],
  ["Mcy;", "\u041C"],
  ["MediumSpace;", "\u205F"],
  ["Mellintrf;", "\u2133"],
  ["Mfr;", "\u{1D510}"],
  ["MinusPlus;", "\u2213"],
  ["Mopf;", "\u{1D544}"],
  ["Mscr;", "\u2133"],
  ["Mu;", "\u039C"],
  ["NJcy;", "\u040A"],
  ["Nacute;", "\u0143"],
  ["Ncaron;", "\u0147"],
  ["Ncedil;", "\u0145"],
  ["Ncy;", "\u041D"],
  ["NegativeMediumSpace;", "\u200B"],
  ["NegativeThickSpace;", "\u200B"],
  ["NegativeThinSpace;", "\u200B"],
  ["NegativeVeryThinSpace;", "\u200B"],
  ["NestedGreaterGreater;", "\u226B"],
  ["NestedLessLess;", "\u226A"],
  ["NewLine;", "\n"],
  ["Nfr;", "\u{1D511}"],
  ["NoBreak;", "\u2060"],
  ["NonBreakingSpace;", "\xA0"],
  ["Nopf;", "\u2115"],
  ["Not;", "\u2AEC"],
  ["NotCongruent;", "\u2262"],
  ["NotCupCap;", "\u226D"],
  ["NotDoubleVerticalBar;", "\u2226"],
  ["NotElement;", "\u2209"],
  ["NotEqual;", "\u2260"],
  ["NotEqualTilde;", "\u2242\u0338"],
  ["NotExists;", "\u2204"],
  ["NotGreater;", "\u226F"],
  ["NotGreaterEqual;", "\u2271"],
  ["NotGreaterFullEqual;", "\u2267\u0338"],
  ["NotGreaterGreater;", "\u226B\u0338"],
  ["NotGreaterLess;", "\u2279"],
  ["NotGreaterSlantEqual;", "\u2A7E\u0338"],
  ["NotGreaterTilde;", "\u2275"],
  ["NotHumpDownHump;", "\u224E\u0338"],
  ["NotHumpEqual;", "\u224F\u0338"],
  ["NotLeftTriangle;", "\u22EA"],
  ["NotLeftTriangleBar;", "\u29CF\u0338"],
  ["NotLeftTriangleEqual;", "\u22EC"],
  ["NotLess;", "\u226E"],
  ["NotLessEqual;", "\u2270"],
  ["NotLessGreater;", "\u2278"],
  ["NotLessLess;", "\u226A\u0338"],
  ["NotLessSlantEqual;", "\u2A7D\u0338"],
  ["NotLessTilde;", "\u2274"],
  ["NotNestedGreaterGreater;", "\u2AA2\u0338"],
  ["NotNestedLessLess;", "\u2AA1\u0338"],
  ["NotPrecedes;", "\u2280"],
  ["NotPrecedesEqual;", "\u2AAF\u0338"],
  ["NotPrecedesSlantEqual;", "\u22E0"],
  ["NotReverseElement;", "\u220C"],
  ["NotRightTriangle;", "\u22EB"],
  ["NotRightTriangleBar;", "\u29D0\u0338"],
  ["NotRightTriangleEqual;", "\u22ED"],
  ["NotSquareSubset;", "\u228F\u0338"],
  ["NotSquareSubsetEqual;", "\u22E2"],
  ["NotSquareSuperset;", "\u2290\u0338"],
  ["NotSquareSupersetEqual;", "\u22E3"],
  ["NotSubset;", "\u2282\u20D2"],
  ["NotSubsetEqual;", "\u2288"],
  ["NotSucceeds;", "\u2281"],
  ["NotSucceedsEqual;", "\u2AB0\u0338"],
  ["NotSucceedsSlantEqual;", "\u22E1"],
  ["NotSucceedsTilde;", "\u227F\u0338"],
  ["NotSuperset;", "\u2283\u20D2"],
  ["NotSupersetEqual;", "\u2289"],
  ["NotTilde;", "\u2241"],
  ["NotTildeEqual;", "\u2244"],
  ["NotTildeFullEqual;", "\u2247"],
  ["NotTildeTilde;", "\u2249"],
  ["NotVerticalBar;", "\u2224"],
  ["Nscr;", "\u{1D4A9}"],
  ["Ntilde", "\xD1"],
  ["Ntilde;", "\xD1"],
  ["Nu;", "\u039D"],
  ["OElig;", "\u0152"],
  ["Oacute", "\xD3"],
  ["Oacute;", "\xD3"],
  ["Ocirc", "\xD4"],
  ["Ocirc;", "\xD4"],
  ["Ocy;", "\u041E"],
  ["Odblac;", "\u0150"],
  ["Ofr;", "\u{1D512}"],
  ["Ograve", "\xD2"],
  ["Ograve;", "\xD2"],
  ["Omacr;", "\u014C"],
  ["Omega;", "\u03A9"],
  ["Omicron;", "\u039F"],
  ["Oopf;", "\u{1D546}"],
  ["OpenCurlyDoubleQuote;", "\u201C"],
  ["OpenCurlyQuote;", "\u2018"],
  ["Or;", "\u2A54"],
  ["Oscr;", "\u{1D4AA}"],
  ["Oslash", "\xD8"],
  ["Oslash;", "\xD8"],
  ["Otilde", "\xD5"],
  ["Otilde;", "\xD5"],
  ["Otimes;", "\u2A37"],
  ["Ouml", "\xD6"],
  ["Ouml;", "\xD6"],
  ["OverBar;", "\u203E"],
  ["OverBrace;", "\u23DE"],
  ["OverBracket;", "\u23B4"],
  ["OverParenthesis;", "\u23DC"],
  ["PartialD;", "\u2202"],
  ["Pcy;", "\u041F"],
  ["Pfr;", "\u{1D513}"],
  ["Phi;", "\u03A6"],
  ["Pi;", "\u03A0"],
  ["PlusMinus;", "\xB1"],
  ["Poincareplane;", "\u210C"],
  ["Popf;", "\u2119"],
  ["Pr;", "\u2ABB"],
  ["Precedes;", "\u227A"],
  ["PrecedesEqual;", "\u2AAF"],
  ["PrecedesSlantEqual;", "\u227C"],
  ["PrecedesTilde;", "\u227E"],
  ["Prime;", "\u2033"],
  ["Product;", "\u220F"],
  ["Proportion;", "\u2237"],
  ["Proportional;", "\u221D"],
  ["Pscr;", "\u{1D4AB}"],
  ["Psi;", "\u03A8"],
  ["QUOT", '"'],
  ["QUOT;", '"'],
  ["Qfr;", "\u{1D514}"],
  ["Qopf;", "\u211A"],
  ["Qscr;", "\u{1D4AC}"],
  ["RBarr;", "\u2910"],
  ["REG", "\xAE"],
  ["REG;", "\xAE"],
  ["Racute;", "\u0154"],
  ["Rang;", "\u27EB"],
  ["Rarr;", "\u21A0"],
  ["Rarrtl;", "\u2916"],
  ["Rcaron;", "\u0158"],
  ["Rcedil;", "\u0156"],
  ["Rcy;", "\u0420"],
  ["Re;", "\u211C"],
  ["ReverseElement;", "\u220B"],
  ["ReverseEquilibrium;", "\u21CB"],
  ["ReverseUpEquilibrium;", "\u296F"],
  ["Rfr;", "\u211C"],
  ["Rho;", "\u03A1"],
  ["RightAngleBracket;", "\u27E9"],
  ["RightArrow;", "\u2192"],
  ["RightArrowBar;", "\u21E5"],
  ["RightArrowLeftArrow;", "\u21C4"],
  ["RightCeiling;", "\u2309"],
  ["RightDoubleBracket;", "\u27E7"],
  ["RightDownTeeVector;", "\u295D"],
  ["RightDownVector;", "\u21C2"],
  ["RightDownVectorBar;", "\u2955"],
  ["RightFloor;", "\u230B"],
  ["RightTee;", "\u22A2"],
  ["RightTeeArrow;", "\u21A6"],
  ["RightTeeVector;", "\u295B"],
  ["RightTriangle;", "\u22B3"],
  ["RightTriangleBar;", "\u29D0"],
  ["RightTriangleEqual;", "\u22B5"],
  ["RightUpDownVector;", "\u294F"],
  ["RightUpTeeVector;", "\u295C"],
  ["RightUpVector;", "\u21BE"],
  ["RightUpVectorBar;", "\u2954"],
  ["RightVector;", "\u21C0"],
  ["RightVectorBar;", "\u2953"],
  ["Rightarrow;", "\u21D2"],
  ["Ropf;", "\u211D"],
  ["RoundImplies;", "\u2970"],
  ["Rrightarrow;", "\u21DB"],
  ["Rscr;", "\u211B"],
  ["Rsh;", "\u21B1"],
  ["RuleDelayed;", "\u29F4"],
  ["SHCHcy;", "\u0429"],
  ["SHcy;", "\u0428"],
  ["SOFTcy;", "\u042C"],
  ["Sacute;", "\u015A"],
  ["Sc;", "\u2ABC"],
  ["Scaron;", "\u0160"],
  ["Scedil;", "\u015E"],
  ["Scirc;", "\u015C"],
  ["Scy;", "\u0421"],
  ["Sfr;", "\u{1D516}"],
  ["ShortDownArrow;", "\u2193"],
  ["ShortLeftArrow;", "\u2190"],
  ["ShortRightArrow;", "\u2192"],
  ["ShortUpArrow;", "\u2191"],
  ["Sigma;", "\u03A3"],
  ["SmallCircle;", "\u2218"],
  ["Sopf;", "\u{1D54A}"],
  ["Sqrt;", "\u221A"],
  ["Square;", "\u25A1"],
  ["SquareIntersection;", "\u2293"],
  ["SquareSubset;", "\u228F"],
  ["SquareSubsetEqual;", "\u2291"],
  ["SquareSuperset;", "\u2290"],
  ["SquareSupersetEqual;", "\u2292"],
  ["SquareUnion;", "\u2294"],
  ["Sscr;", "\u{1D4AE}"],
  ["Star;", "\u22C6"],
  ["Sub;", "\u22D0"],
  ["Subset;", "\u22D0"],
  ["SubsetEqual;", "\u2286"],
  ["Succeeds;", "\u227B"],
  ["SucceedsEqual;", "\u2AB0"],
  ["SucceedsSlantEqual;", "\u227D"],
  ["SucceedsTilde;", "\u227F"],
  ["SuchThat;", "\u220B"],
  ["Sum;", "\u2211"],
  ["Sup;", "\u22D1"],
  ["Superset;", "\u2283"],
  ["SupersetEqual;", "\u2287"],
  ["Supset;", "\u22D1"],
  ["THORN", "\xDE"],
  ["THORN;", "\xDE"],
  ["TRADE;", "\u2122"],
  ["TSHcy;", "\u040B"],
  ["TScy;", "\u0426"],
  ["Tab;", "	"],
  ["Tau;", "\u03A4"],
  ["Tcaron;", "\u0164"],
  ["Tcedil;", "\u0162"],
  ["Tcy;", "\u0422"],
  ["Tfr;", "\u{1D517}"],
  ["Therefore;", "\u2234"],
  ["Theta;", "\u0398"],
  ["ThickSpace;", "\u205F\u200A"],
  ["ThinSpace;", "\u2009"],
  ["Tilde;", "\u223C"],
  ["TildeEqual;", "\u2243"],
  ["TildeFullEqual;", "\u2245"],
  ["TildeTilde;", "\u2248"],
  ["Topf;", "\u{1D54B}"],
  ["TripleDot;", "\u20DB"],
  ["Tscr;", "\u{1D4AF}"],
  ["Tstrok;", "\u0166"],
  ["Uacute", "\xDA"],
  ["Uacute;", "\xDA"],
  ["Uarr;", "\u219F"],
  ["Uarrocir;", "\u2949"],
  ["Ubrcy;", "\u040E"],
  ["Ubreve;", "\u016C"],
  ["Ucirc", "\xDB"],
  ["Ucirc;", "\xDB"],
  ["Ucy;", "\u0423"],
  ["Udblac;", "\u0170"],
  ["Ufr;", "\u{1D518}"],
  ["Ugrave", "\xD9"],
  ["Ugrave;", "\xD9"],
  ["Umacr;", "\u016A"],
  ["UnderBar;", "_"],
  ["UnderBrace;", "\u23DF"],
  ["UnderBracket;", "\u23B5"],
  ["UnderParenthesis;", "\u23DD"],
  ["Union;", "\u22C3"],
  ["UnionPlus;", "\u228E"],
  ["Uogon;", "\u0172"],
  ["Uopf;", "\u{1D54C}"],
  ["UpArrow;", "\u2191"],
  ["UpArrowBar;", "\u2912"],
  ["UpArrowDownArrow;", "\u21C5"],
  ["UpDownArrow;", "\u2195"],
  ["UpEquilibrium;", "\u296E"],
  ["UpTee;", "\u22A5"],
  ["UpTeeArrow;", "\u21A5"],
  ["Uparrow;", "\u21D1"],
  ["Updownarrow;", "\u21D5"],
  ["UpperLeftArrow;", "\u2196"],
  ["UpperRightArrow;", "\u2197"],
  ["Upsi;", "\u03D2"],
  ["Upsilon;", "\u03A5"],
  ["Uring;", "\u016E"],
  ["Uscr;", "\u{1D4B0}"],
  ["Utilde;", "\u0168"],
  ["Uuml", "\xDC"],
  ["Uuml;", "\xDC"],
  ["VDash;", "\u22AB"],
  ["Vbar;", "\u2AEB"],
  ["Vcy;", "\u0412"],
  ["Vdash;", "\u22A9"],
  ["Vdashl;", "\u2AE6"],
  ["Vee;", "\u22C1"],
  ["Verbar;", "\u2016"],
  ["Vert;", "\u2016"],
  ["VerticalBar;", "\u2223"],
  ["VerticalLine;", "|"],
  ["VerticalSeparator;", "\u2758"],
  ["VerticalTilde;", "\u2240"],
  ["VeryThinSpace;", "\u200A"],
  ["Vfr;", "\u{1D519}"],
  ["Vopf;", "\u{1D54D}"],
  ["Vscr;", "\u{1D4B1}"],
  ["Vvdash;", "\u22AA"],
  ["Wcirc;", "\u0174"],
  ["Wedge;", "\u22C0"],
  ["Wfr;", "\u{1D51A}"],
  ["Wopf;", "\u{1D54E}"],
  ["Wscr;", "\u{1D4B2}"],
  ["Xfr;", "\u{1D51B}"],
  ["Xi;", "\u039E"],
  ["Xopf;", "\u{1D54F}"],
  ["Xscr;", "\u{1D4B3}"],
  ["YAcy;", "\u042F"],
  ["YIcy;", "\u0407"],
  ["YUcy;", "\u042E"],
  ["Yacute", "\xDD"],
  ["Yacute;", "\xDD"],
  ["Ycirc;", "\u0176"],
  ["Ycy;", "\u042B"],
  ["Yfr;", "\u{1D51C}"],
  ["Yopf;", "\u{1D550}"],
  ["Yscr;", "\u{1D4B4}"],
  ["Yuml;", "\u0178"],
  ["ZHcy;", "\u0416"],
  ["Zacute;", "\u0179"],
  ["Zcaron;", "\u017D"],
  ["Zcy;", "\u0417"],
  ["Zdot;", "\u017B"],
  ["ZeroWidthSpace;", "\u200B"],
  ["Zeta;", "\u0396"],
  ["Zfr;", "\u2128"],
  ["Zopf;", "\u2124"],
  ["Zscr;", "\u{1D4B5}"],
  ["aacute", "\xE1"],
  ["aacute;", "\xE1"],
  ["abreve;", "\u0103"],
  ["ac;", "\u223E"],
  ["acE;", "\u223E\u0333"],
  ["acd;", "\u223F"],
  ["acirc", "\xE2"],
  ["acirc;", "\xE2"],
  ["acute", "\xB4"],
  ["acute;", "\xB4"],
  ["acy;", "\u0430"],
  ["aelig", "\xE6"],
  ["aelig;", "\xE6"],
  ["af;", "\u2061"],
  ["afr;", "\u{1D51E}"],
  ["agrave", "\xE0"],
  ["agrave;", "\xE0"],
  ["alefsym;", "\u2135"],
  ["aleph;", "\u2135"],
  ["alpha;", "\u03B1"],
  ["amacr;", "\u0101"],
  ["amalg;", "\u2A3F"],
  ["amp", "&"],
  ["amp;", "&"],
  ["and;", "\u2227"],
  ["andand;", "\u2A55"],
  ["andd;", "\u2A5C"],
  ["andslope;", "\u2A58"],
  ["andv;", "\u2A5A"],
  ["ang;", "\u2220"],
  ["ange;", "\u29A4"],
  ["angle;", "\u2220"],
  ["angmsd;", "\u2221"],
  ["angmsdaa;", "\u29A8"],
  ["angmsdab;", "\u29A9"],
  ["angmsdac;", "\u29AA"],
  ["angmsdad;", "\u29AB"],
  ["angmsdae;", "\u29AC"],
  ["angmsdaf;", "\u29AD"],
  ["angmsdag;", "\u29AE"],
  ["angmsdah;", "\u29AF"],
  ["angrt;", "\u221F"],
  ["angrtvb;", "\u22BE"],
  ["angrtvbd;", "\u299D"],
  ["angsph;", "\u2222"],
  ["angst;", "\xC5"],
  ["angzarr;", "\u237C"],
  ["aogon;", "\u0105"],
  ["aopf;", "\u{1D552}"],
  ["ap;", "\u2248"],
  ["apE;", "\u2A70"],
  ["apacir;", "\u2A6F"],
  ["ape;", "\u224A"],
  ["apid;", "\u224B"],
  ["apos;", "'"],
  ["approx;", "\u2248"],
  ["approxeq;", "\u224A"],
  ["aring", "\xE5"],
  ["aring;", "\xE5"],
  ["ascr;", "\u{1D4B6}"],
  ["ast;", "*"],
  ["asymp;", "\u2248"],
  ["asympeq;", "\u224D"],
  ["atilde", "\xE3"],
  ["atilde;", "\xE3"],
  ["auml", "\xE4"],
  ["auml;", "\xE4"],
  ["awconint;", "\u2233"],
  ["awint;", "\u2A11"],
  ["bNot;", "\u2AED"],
  ["backcong;", "\u224C"],
  ["backepsilon;", "\u03F6"],
  ["backprime;", "\u2035"],
  ["backsim;", "\u223D"],
  ["backsimeq;", "\u22CD"],
  ["barvee;", "\u22BD"],
  ["barwed;", "\u2305"],
  ["barwedge;", "\u2305"],
  ["bbrk;", "\u23B5"],
  ["bbrktbrk;", "\u23B6"],
  ["bcong;", "\u224C"],
  ["bcy;", "\u0431"],
  ["bdquo;", "\u201E"],
  ["becaus;", "\u2235"],
  ["because;", "\u2235"],
  ["bemptyv;", "\u29B0"],
  ["bepsi;", "\u03F6"],
  ["bernou;", "\u212C"],
  ["beta;", "\u03B2"],
  ["beth;", "\u2136"],
  ["between;", "\u226C"],
  ["bfr;", "\u{1D51F}"],
  ["bigcap;", "\u22C2"],
  ["bigcirc;", "\u25EF"],
  ["bigcup;", "\u22C3"],
  ["bigodot;", "\u2A00"],
  ["bigoplus;", "\u2A01"],
  ["bigotimes;", "\u2A02"],
  ["bigsqcup;", "\u2A06"],
  ["bigstar;", "\u2605"],
  ["bigtriangledown;", "\u25BD"],
  ["bigtriangleup;", "\u25B3"],
  ["biguplus;", "\u2A04"],
  ["bigvee;", "\u22C1"],
  ["bigwedge;", "\u22C0"],
  ["bkarow;", "\u290D"],
  ["blacklozenge;", "\u29EB"],
  ["blacksquare;", "\u25AA"],
  ["blacktriangle;", "\u25B4"],
  ["blacktriangledown;", "\u25BE"],
  ["blacktriangleleft;", "\u25C2"],
  ["blacktriangleright;", "\u25B8"],
  ["blank;", "\u2423"],
  ["blk12;", "\u2592"],
  ["blk14;", "\u2591"],
  ["blk34;", "\u2593"],
  ["block;", "\u2588"],
  ["bne;", "=\u20E5"],
  ["bnequiv;", "\u2261\u20E5"],
  ["bnot;", "\u2310"],
  ["bopf;", "\u{1D553}"],
  ["bot;", "\u22A5"],
  ["bottom;", "\u22A5"],
  ["bowtie;", "\u22C8"],
  ["boxDL;", "\u2557"],
  ["boxDR;", "\u2554"],
  ["boxDl;", "\u2556"],
  ["boxDr;", "\u2553"],
  ["boxH;", "\u2550"],
  ["boxHD;", "\u2566"],
  ["boxHU;", "\u2569"],
  ["boxHd;", "\u2564"],
  ["boxHu;", "\u2567"],
  ["boxUL;", "\u255D"],
  ["boxUR;", "\u255A"],
  ["boxUl;", "\u255C"],
  ["boxUr;", "\u2559"],
  ["boxV;", "\u2551"],
  ["boxVH;", "\u256C"],
  ["boxVL;", "\u2563"],
  ["boxVR;", "\u2560"],
  ["boxVh;", "\u256B"],
  ["boxVl;", "\u2562"],
  ["boxVr;", "\u255F"],
  ["boxbox;", "\u29C9"],
  ["boxdL;", "\u2555"],
  ["boxdR;", "\u2552"],
  ["boxdl;", "\u2510"],
  ["boxdr;", "\u250C"],
  ["boxh;", "\u2500"],
  ["boxhD;", "\u2565"],
  ["boxhU;", "\u2568"],
  ["boxhd;", "\u252C"],
  ["boxhu;", "\u2534"],
  ["boxminus;", "\u229F"],
  ["boxplus;", "\u229E"],
  ["boxtimes;", "\u22A0"],
  ["boxuL;", "\u255B"],
  ["boxuR;", "\u2558"],
  ["boxul;", "\u2518"],
  ["boxur;", "\u2514"],
  ["boxv;", "\u2502"],
  ["boxvH;", "\u256A"],
  ["boxvL;", "\u2561"],
  ["boxvR;", "\u255E"],
  ["boxvh;", "\u253C"],
  ["boxvl;", "\u2524"],
  ["boxvr;", "\u251C"],
  ["bprime;", "\u2035"],
  ["breve;", "\u02D8"],
  ["brvbar", "\xA6"],
  ["brvbar;", "\xA6"],
  ["bscr;", "\u{1D4B7}"],
  ["bsemi;", "\u204F"],
  ["bsim;", "\u223D"],
  ["bsime;", "\u22CD"],
  ["bsol;", "\\"],
  ["bsolb;", "\u29C5"],
  ["bsolhsub;", "\u27C8"],
  ["bull;", "\u2022"],
  ["bullet;", "\u2022"],
  ["bump;", "\u224E"],
  ["bumpE;", "\u2AAE"],
  ["bumpe;", "\u224F"],
  ["bumpeq;", "\u224F"],
  ["cacute;", "\u0107"],
  ["cap;", "\u2229"],
  ["capand;", "\u2A44"],
  ["capbrcup;", "\u2A49"],
  ["capcap;", "\u2A4B"],
  ["capcup;", "\u2A47"],
  ["capdot;", "\u2A40"],
  ["caps;", "\u2229\uFE00"],
  ["caret;", "\u2041"],
  ["caron;", "\u02C7"],
  ["ccaps;", "\u2A4D"],
  ["ccaron;", "\u010D"],
  ["ccedil", "\xE7"],
  ["ccedil;", "\xE7"],
  ["ccirc;", "\u0109"],
  ["ccups;", "\u2A4C"],
  ["ccupssm;", "\u2A50"],
  ["cdot;", "\u010B"],
  ["cedil", "\xB8"],
  ["cedil;", "\xB8"],
  ["cemptyv;", "\u29B2"],
  ["cent", "\xA2"],
  ["cent;", "\xA2"],
  ["centerdot;", "\xB7"],
  ["cfr;", "\u{1D520}"],
  ["chcy;", "\u0447"],
  ["check;", "\u2713"],
  ["checkmark;", "\u2713"],
  ["chi;", "\u03C7"],
  ["cir;", "\u25CB"],
  ["cirE;", "\u29C3"],
  ["circ;", "\u02C6"],
  ["circeq;", "\u2257"],
  ["circlearrowleft;", "\u21BA"],
  ["circlearrowright;", "\u21BB"],
  ["circledR;", "\xAE"],
  ["circledS;", "\u24C8"],
  ["circledast;", "\u229B"],
  ["circledcirc;", "\u229A"],
  ["circleddash;", "\u229D"],
  ["cire;", "\u2257"],
  ["cirfnint;", "\u2A10"],
  ["cirmid;", "\u2AEF"],
  ["cirscir;", "\u29C2"],
  ["clubs;", "\u2663"],
  ["clubsuit;", "\u2663"],
  ["colon;", ":"],
  ["colone;", "\u2254"],
  ["coloneq;", "\u2254"],
  ["comma;", ","],
  ["commat;", "@"],
  ["comp;", "\u2201"],
  ["compfn;", "\u2218"],
  ["complement;", "\u2201"],
  ["complexes;", "\u2102"],
  ["cong;", "\u2245"],
  ["congdot;", "\u2A6D"],
  ["conint;", "\u222E"],
  ["copf;", "\u{1D554}"],
  ["coprod;", "\u2210"],
  ["copy", "\xA9"],
  ["copy;", "\xA9"],
  ["copysr;", "\u2117"],
  ["crarr;", "\u21B5"],
  ["cross;", "\u2717"],
  ["cscr;", "\u{1D4B8}"],
  ["csub;", "\u2ACF"],
  ["csube;", "\u2AD1"],
  ["csup;", "\u2AD0"],
  ["csupe;", "\u2AD2"],
  ["ctdot;", "\u22EF"],
  ["cudarrl;", "\u2938"],
  ["cudarrr;", "\u2935"],
  ["cuepr;", "\u22DE"],
  ["cuesc;", "\u22DF"],
  ["cularr;", "\u21B6"],
  ["cularrp;", "\u293D"],
  ["cup;", "\u222A"],
  ["cupbrcap;", "\u2A48"],
  ["cupcap;", "\u2A46"],
  ["cupcup;", "\u2A4A"],
  ["cupdot;", "\u228D"],
  ["cupor;", "\u2A45"],
  ["cups;", "\u222A\uFE00"],
  ["curarr;", "\u21B7"],
  ["curarrm;", "\u293C"],
  ["curlyeqprec;", "\u22DE"],
  ["curlyeqsucc;", "\u22DF"],
  ["curlyvee;", "\u22CE"],
  ["curlywedge;", "\u22CF"],
  ["curren", "\xA4"],
  ["curren;", "\xA4"],
  ["curvearrowleft;", "\u21B6"],
  ["curvearrowright;", "\u21B7"],
  ["cuvee;", "\u22CE"],
  ["cuwed;", "\u22CF"],
  ["cwconint;", "\u2232"],
  ["cwint;", "\u2231"],
  ["cylcty;", "\u232D"],
  ["dArr;", "\u21D3"],
  ["dHar;", "\u2965"],
  ["dagger;", "\u2020"],
  ["daleth;", "\u2138"],
  ["darr;", "\u2193"],
  ["dash;", "\u2010"],
  ["dashv;", "\u22A3"],
  ["dbkarow;", "\u290F"],
  ["dblac;", "\u02DD"],
  ["dcaron;", "\u010F"],
  ["dcy;", "\u0434"],
  ["dd;", "\u2146"],
  ["ddagger;", "\u2021"],
  ["ddarr;", "\u21CA"],
  ["ddotseq;", "\u2A77"],
  ["deg", "\xB0"],
  ["deg;", "\xB0"],
  ["delta;", "\u03B4"],
  ["demptyv;", "\u29B1"],
  ["dfisht;", "\u297F"],
  ["dfr;", "\u{1D521}"],
  ["dharl;", "\u21C3"],
  ["dharr;", "\u21C2"],
  ["diam;", "\u22C4"],
  ["diamond;", "\u22C4"],
  ["diamondsuit;", "\u2666"],
  ["diams;", "\u2666"],
  ["die;", "\xA8"],
  ["digamma;", "\u03DD"],
  ["disin;", "\u22F2"],
  ["div;", "\xF7"],
  ["divide", "\xF7"],
  ["divide;", "\xF7"],
  ["divideontimes;", "\u22C7"],
  ["divonx;", "\u22C7"],
  ["djcy;", "\u0452"],
  ["dlcorn;", "\u231E"],
  ["dlcrop;", "\u230D"],
  ["dollar;", "$"],
  ["dopf;", "\u{1D555}"],
  ["dot;", "\u02D9"],
  ["doteq;", "\u2250"],
  ["doteqdot;", "\u2251"],
  ["dotminus;", "\u2238"],
  ["dotplus;", "\u2214"],
  ["dotsquare;", "\u22A1"],
  ["doublebarwedge;", "\u2306"],
  ["downarrow;", "\u2193"],
  ["downdownarrows;", "\u21CA"],
  ["downharpoonleft;", "\u21C3"],
  ["downharpoonright;", "\u21C2"],
  ["drbkarow;", "\u2910"],
  ["drcorn;", "\u231F"],
  ["drcrop;", "\u230C"],
  ["dscr;", "\u{1D4B9}"],
  ["dscy;", "\u0455"],
  ["dsol;", "\u29F6"],
  ["dstrok;", "\u0111"],
  ["dtdot;", "\u22F1"],
  ["dtri;", "\u25BF"],
  ["dtrif;", "\u25BE"],
  ["duarr;", "\u21F5"],
  ["duhar;", "\u296F"],
  ["dwangle;", "\u29A6"],
  ["dzcy;", "\u045F"],
  ["dzigrarr;", "\u27FF"],
  ["eDDot;", "\u2A77"],
  ["eDot;", "\u2251"],
  ["eacute", "\xE9"],
  ["eacute;", "\xE9"],
  ["easter;", "\u2A6E"],
  ["ecaron;", "\u011B"],
  ["ecir;", "\u2256"],
  ["ecirc", "\xEA"],
  ["ecirc;", "\xEA"],
  ["ecolon;", "\u2255"],
  ["ecy;", "\u044D"],
  ["edot;", "\u0117"],
  ["ee;", "\u2147"],
  ["efDot;", "\u2252"],
  ["efr;", "\u{1D522}"],
  ["eg;", "\u2A9A"],
  ["egrave", "\xE8"],
  ["egrave;", "\xE8"],
  ["egs;", "\u2A96"],
  ["egsdot;", "\u2A98"],
  ["el;", "\u2A99"],
  ["elinters;", "\u23E7"],
  ["ell;", "\u2113"],
  ["els;", "\u2A95"],
  ["elsdot;", "\u2A97"],
  ["emacr;", "\u0113"],
  ["empty;", "\u2205"],
  ["emptyset;", "\u2205"],
  ["emptyv;", "\u2205"],
  ["emsp13;", "\u2004"],
  ["emsp14;", "\u2005"],
  ["emsp;", "\u2003"],
  ["eng;", "\u014B"],
  ["ensp;", "\u2002"],
  ["eogon;", "\u0119"],
  ["eopf;", "\u{1D556}"],
  ["epar;", "\u22D5"],
  ["eparsl;", "\u29E3"],
  ["eplus;", "\u2A71"],
  ["epsi;", "\u03B5"],
  ["epsilon;", "\u03B5"],
  ["epsiv;", "\u03F5"],
  ["eqcirc;", "\u2256"],
  ["eqcolon;", "\u2255"],
  ["eqsim;", "\u2242"],
  ["eqslantgtr;", "\u2A96"],
  ["eqslantless;", "\u2A95"],
  ["equals;", "="],
  ["equest;", "\u225F"],
  ["equiv;", "\u2261"],
  ["equivDD;", "\u2A78"],
  ["eqvparsl;", "\u29E5"],
  ["erDot;", "\u2253"],
  ["erarr;", "\u2971"],
  ["escr;", "\u212F"],
  ["esdot;", "\u2250"],
  ["esim;", "\u2242"],
  ["eta;", "\u03B7"],
  ["eth", "\xF0"],
  ["eth;", "\xF0"],
  ["euml", "\xEB"],
  ["euml;", "\xEB"],
  ["euro;", "\u20AC"],
  ["excl;", "!"],
  ["exist;", "\u2203"],
  ["expectation;", "\u2130"],
  ["exponentiale;", "\u2147"],
  ["fallingdotseq;", "\u2252"],
  ["fcy;", "\u0444"],
  ["female;", "\u2640"],
  ["ffilig;", "\uFB03"],
  ["fflig;", "\uFB00"],
  ["ffllig;", "\uFB04"],
  ["ffr;", "\u{1D523}"],
  ["filig;", "\uFB01"],
  ["fjlig;", "fj"],
  ["flat;", "\u266D"],
  ["fllig;", "\uFB02"],
  ["fltns;", "\u25B1"],
  ["fnof;", "\u0192"],
  ["fopf;", "\u{1D557}"],
  ["forall;", "\u2200"],
  ["fork;", "\u22D4"],
  ["forkv;", "\u2AD9"],
  ["fpartint;", "\u2A0D"],
  ["frac12", "\xBD"],
  ["frac12;", "\xBD"],
  ["frac13;", "\u2153"],
  ["frac14", "\xBC"],
  ["frac14;", "\xBC"],
  ["frac15;", "\u2155"],
  ["frac16;", "\u2159"],
  ["frac18;", "\u215B"],
  ["frac23;", "\u2154"],
  ["frac25;", "\u2156"],
  ["frac34", "\xBE"],
  ["frac34;", "\xBE"],
  ["frac35;", "\u2157"],
  ["frac38;", "\u215C"],
  ["frac45;", "\u2158"],
  ["frac56;", "\u215A"],
  ["frac58;", "\u215D"],
  ["frac78;", "\u215E"],
  ["frasl;", "\u2044"],
  ["frown;", "\u2322"],
  ["fscr;", "\u{1D4BB}"],
  ["gE;", "\u2267"],
  ["gEl;", "\u2A8C"],
  ["gacute;", "\u01F5"],
  ["gamma;", "\u03B3"],
  ["gammad;", "\u03DD"],
  ["gap;", "\u2A86"],
  ["gbreve;", "\u011F"],
  ["gcirc;", "\u011D"],
  ["gcy;", "\u0433"],
  ["gdot;", "\u0121"],
  ["ge;", "\u2265"],
  ["gel;", "\u22DB"],
  ["geq;", "\u2265"],
  ["geqq;", "\u2267"],
  ["geqslant;", "\u2A7E"],
  ["ges;", "\u2A7E"],
  ["gescc;", "\u2AA9"],
  ["gesdot;", "\u2A80"],
  ["gesdoto;", "\u2A82"],
  ["gesdotol;", "\u2A84"],
  ["gesl;", "\u22DB\uFE00"],
  ["gesles;", "\u2A94"],
  ["gfr;", "\u{1D524}"],
  ["gg;", "\u226B"],
  ["ggg;", "\u22D9"],
  ["gimel;", "\u2137"],
  ["gjcy;", "\u0453"],
  ["gl;", "\u2277"],
  ["glE;", "\u2A92"],
  ["gla;", "\u2AA5"],
  ["glj;", "\u2AA4"],
  ["gnE;", "\u2269"],
  ["gnap;", "\u2A8A"],
  ["gnapprox;", "\u2A8A"],
  ["gne;", "\u2A88"],
  ["gneq;", "\u2A88"],
  ["gneqq;", "\u2269"],
  ["gnsim;", "\u22E7"],
  ["gopf;", "\u{1D558}"],
  ["grave;", "`"],
  ["gscr;", "\u210A"],
  ["gsim;", "\u2273"],
  ["gsime;", "\u2A8E"],
  ["gsiml;", "\u2A90"],
  ["gt", ">"],
  ["gt;", ">"],
  ["gtcc;", "\u2AA7"],
  ["gtcir;", "\u2A7A"],
  ["gtdot;", "\u22D7"],
  ["gtlPar;", "\u2995"],
  ["gtquest;", "\u2A7C"],
  ["gtrapprox;", "\u2A86"],
  ["gtrarr;", "\u2978"],
  ["gtrdot;", "\u22D7"],
  ["gtreqless;", "\u22DB"],
  ["gtreqqless;", "\u2A8C"],
  ["gtrless;", "\u2277"],
  ["gtrsim;", "\u2273"],
  ["gvertneqq;", "\u2269\uFE00"],
  ["gvnE;", "\u2269\uFE00"],
  ["hArr;", "\u21D4"],
  ["hairsp;", "\u200A"],
  ["half;", "\xBD"],
  ["hamilt;", "\u210B"],
  ["hardcy;", "\u044A"],
  ["harr;", "\u2194"],
  ["harrcir;", "\u2948"],
  ["harrw;", "\u21AD"],
  ["hbar;", "\u210F"],
  ["hcirc;", "\u0125"],
  ["hearts;", "\u2665"],
  ["heartsuit;", "\u2665"],
  ["hellip;", "\u2026"],
  ["hercon;", "\u22B9"],
  ["hfr;", "\u{1D525}"],
  ["hksearow;", "\u2925"],
  ["hkswarow;", "\u2926"],
  ["hoarr;", "\u21FF"],
  ["homtht;", "\u223B"],
  ["hookleftarrow;", "\u21A9"],
  ["hookrightarrow;", "\u21AA"],
  ["hopf;", "\u{1D559}"],
  ["horbar;", "\u2015"],
  ["hscr;", "\u{1D4BD}"],
  ["hslash;", "\u210F"],
  ["hstrok;", "\u0127"],
  ["hybull;", "\u2043"],
  ["hyphen;", "\u2010"],
  ["iacute", "\xED"],
  ["iacute;", "\xED"],
  ["ic;", "\u2063"],
  ["icirc", "\xEE"],
  ["icirc;", "\xEE"],
  ["icy;", "\u0438"],
  ["iecy;", "\u0435"],
  ["iexcl", "\xA1"],
  ["iexcl;", "\xA1"],
  ["iff;", "\u21D4"],
  ["ifr;", "\u{1D526}"],
  ["igrave", "\xEC"],
  ["igrave;", "\xEC"],
  ["ii;", "\u2148"],
  ["iiiint;", "\u2A0C"],
  ["iiint;", "\u222D"],
  ["iinfin;", "\u29DC"],
  ["iiota;", "\u2129"],
  ["ijlig;", "\u0133"],
  ["imacr;", "\u012B"],
  ["image;", "\u2111"],
  ["imagline;", "\u2110"],
  ["imagpart;", "\u2111"],
  ["imath;", "\u0131"],
  ["imof;", "\u22B7"],
  ["imped;", "\u01B5"],
  ["in;", "\u2208"],
  ["incare;", "\u2105"],
  ["infin;", "\u221E"],
  ["infintie;", "\u29DD"],
  ["inodot;", "\u0131"],
  ["int;", "\u222B"],
  ["intcal;", "\u22BA"],
  ["integers;", "\u2124"],
  ["intercal;", "\u22BA"],
  ["intlarhk;", "\u2A17"],
  ["intprod;", "\u2A3C"],
  ["iocy;", "\u0451"],
  ["iogon;", "\u012F"],
  ["iopf;", "\u{1D55A}"],
  ["iota;", "\u03B9"],
  ["iprod;", "\u2A3C"],
  ["iquest", "\xBF"],
  ["iquest;", "\xBF"],
  ["iscr;", "\u{1D4BE}"],
  ["isin;", "\u2208"],
  ["isinE;", "\u22F9"],
  ["isindot;", "\u22F5"],
  ["isins;", "\u22F4"],
  ["isinsv;", "\u22F3"],
  ["isinv;", "\u2208"],
  ["it;", "\u2062"],
  ["itilde;", "\u0129"],
  ["iukcy;", "\u0456"],
  ["iuml", "\xEF"],
  ["iuml;", "\xEF"],
  ["jcirc;", "\u0135"],
  ["jcy;", "\u0439"],
  ["jfr;", "\u{1D527}"],
  ["jmath;", "\u0237"],
  ["jopf;", "\u{1D55B}"],
  ["jscr;", "\u{1D4BF}"],
  ["jsercy;", "\u0458"],
  ["jukcy;", "\u0454"],
  ["kappa;", "\u03BA"],
  ["kappav;", "\u03F0"],
  ["kcedil;", "\u0137"],
  ["kcy;", "\u043A"],
  ["kfr;", "\u{1D528}"],
  ["kgreen;", "\u0138"],
  ["khcy;", "\u0445"],
  ["kjcy;", "\u045C"],
  ["kopf;", "\u{1D55C}"],
  ["kscr;", "\u{1D4C0}"],
  ["lAarr;", "\u21DA"],
  ["lArr;", "\u21D0"],
  ["lAtail;", "\u291B"],
  ["lBarr;", "\u290E"],
  ["lE;", "\u2266"],
  ["lEg;", "\u2A8B"],
  ["lHar;", "\u2962"],
  ["lacute;", "\u013A"],
  ["laemptyv;", "\u29B4"],
  ["lagran;", "\u2112"],
  ["lambda;", "\u03BB"],
  ["lang;", "\u27E8"],
  ["langd;", "\u2991"],
  ["langle;", "\u27E8"],
  ["lap;", "\u2A85"],
  ["laquo", "\xAB"],
  ["laquo;", "\xAB"],
  ["larr;", "\u2190"],
  ["larrb;", "\u21E4"],
  ["larrbfs;", "\u291F"],
  ["larrfs;", "\u291D"],
  ["larrhk;", "\u21A9"],
  ["larrlp;", "\u21AB"],
  ["larrpl;", "\u2939"],
  ["larrsim;", "\u2973"],
  ["larrtl;", "\u21A2"],
  ["lat;", "\u2AAB"],
  ["latail;", "\u2919"],
  ["late;", "\u2AAD"],
  ["lates;", "\u2AAD\uFE00"],
  ["lbarr;", "\u290C"],
  ["lbbrk;", "\u2772"],
  ["lbrace;", "{"],
  ["lbrack;", "["],
  ["lbrke;", "\u298B"],
  ["lbrksld;", "\u298F"],
  ["lbrkslu;", "\u298D"],
  ["lcaron;", "\u013E"],
  ["lcedil;", "\u013C"],
  ["lceil;", "\u2308"],
  ["lcub;", "{"],
  ["lcy;", "\u043B"],
  ["ldca;", "\u2936"],
  ["ldquo;", "\u201C"],
  ["ldquor;", "\u201E"],
  ["ldrdhar;", "\u2967"],
  ["ldrushar;", "\u294B"],
  ["ldsh;", "\u21B2"],
  ["le;", "\u2264"],
  ["leftarrow;", "\u2190"],
  ["leftarrowtail;", "\u21A2"],
  ["leftharpoondown;", "\u21BD"],
  ["leftharpoonup;", "\u21BC"],
  ["leftleftarrows;", "\u21C7"],
  ["leftrightarrow;", "\u2194"],
  ["leftrightarrows;", "\u21C6"],
  ["leftrightharpoons;", "\u21CB"],
  ["leftrightsquigarrow;", "\u21AD"],
  ["leftthreetimes;", "\u22CB"],
  ["leg;", "\u22DA"],
  ["leq;", "\u2264"],
  ["leqq;", "\u2266"],
  ["leqslant;", "\u2A7D"],
  ["les;", "\u2A7D"],
  ["lescc;", "\u2AA8"],
  ["lesdot;", "\u2A7F"],
  ["lesdoto;", "\u2A81"],
  ["lesdotor;", "\u2A83"],
  ["lesg;", "\u22DA\uFE00"],
  ["lesges;", "\u2A93"],
  ["lessapprox;", "\u2A85"],
  ["lessdot;", "\u22D6"],
  ["lesseqgtr;", "\u22DA"],
  ["lesseqqgtr;", "\u2A8B"],
  ["lessgtr;", "\u2276"],
  ["lesssim;", "\u2272"],
  ["lfisht;", "\u297C"],
  ["lfloor;", "\u230A"],
  ["lfr;", "\u{1D529}"],
  ["lg;", "\u2276"],
  ["lgE;", "\u2A91"],
  ["lhard;", "\u21BD"],
  ["lharu;", "\u21BC"],
  ["lharul;", "\u296A"],
  ["lhblk;", "\u2584"],
  ["ljcy;", "\u0459"],
  ["ll;", "\u226A"],
  ["llarr;", "\u21C7"],
  ["llcorner;", "\u231E"],
  ["llhard;", "\u296B"],
  ["lltri;", "\u25FA"],
  ["lmidot;", "\u0140"],
  ["lmoust;", "\u23B0"],
  ["lmoustache;", "\u23B0"],
  ["lnE;", "\u2268"],
  ["lnap;", "\u2A89"],
  ["lnapprox;", "\u2A89"],
  ["lne;", "\u2A87"],
  ["lneq;", "\u2A87"],
  ["lneqq;", "\u2268"],
  ["lnsim;", "\u22E6"],
  ["loang;", "\u27EC"],
  ["loarr;", "\u21FD"],
  ["lobrk;", "\u27E6"],
  ["longleftarrow;", "\u27F5"],
  ["longleftrightarrow;", "\u27F7"],
  ["longmapsto;", "\u27FC"],
  ["longrightarrow;", "\u27F6"],
  ["looparrowleft;", "\u21AB"],
  ["looparrowright;", "\u21AC"],
  ["lopar;", "\u2985"],
  ["lopf;", "\u{1D55D}"],
  ["loplus;", "\u2A2D"],
  ["lotimes;", "\u2A34"],
  ["lowast;", "\u2217"],
  ["lowbar;", "_"],
  ["loz;", "\u25CA"],
  ["lozenge;", "\u25CA"],
  ["lozf;", "\u29EB"],
  ["lpar;", "("],
  ["lparlt;", "\u2993"],
  ["lrarr;", "\u21C6"],
  ["lrcorner;", "\u231F"],
  ["lrhar;", "\u21CB"],
  ["lrhard;", "\u296D"],
  ["lrm;", "\u200E"],
  ["lrtri;", "\u22BF"],
  ["lsaquo;", "\u2039"],
  ["lscr;", "\u{1D4C1}"],
  ["lsh;", "\u21B0"],
  ["lsim;", "\u2272"],
  ["lsime;", "\u2A8D"],
  ["lsimg;", "\u2A8F"],
  ["lsqb;", "["],
  ["lsquo;", "\u2018"],
  ["lsquor;", "\u201A"],
  ["lstrok;", "\u0142"],
  ["lt", "<"],
  ["lt;", "<"],
  ["ltcc;", "\u2AA6"],
  ["ltcir;", "\u2A79"],
  ["ltdot;", "\u22D6"],
  ["lthree;", "\u22CB"],
  ["ltimes;", "\u22C9"],
  ["ltlarr;", "\u2976"],
  ["ltquest;", "\u2A7B"],
  ["ltrPar;", "\u2996"],
  ["ltri;", "\u25C3"],
  ["ltrie;", "\u22B4"],
  ["ltrif;", "\u25C2"],
  ["lurdshar;", "\u294A"],
  ["luruhar;", "\u2966"],
  ["lvertneqq;", "\u2268\uFE00"],
  ["lvnE;", "\u2268\uFE00"],
  ["mDDot;", "\u223A"],
  ["macr", "\xAF"],
  ["macr;", "\xAF"],
  ["male;", "\u2642"],
  ["malt;", "\u2720"],
  ["maltese;", "\u2720"],
  ["map;", "\u21A6"],
  ["mapsto;", "\u21A6"],
  ["mapstodown;", "\u21A7"],
  ["mapstoleft;", "\u21A4"],
  ["mapstoup;", "\u21A5"],
  ["marker;", "\u25AE"],
  ["mcomma;", "\u2A29"],
  ["mcy;", "\u043C"],
  ["mdash;", "\u2014"],
  ["measuredangle;", "\u2221"],
  ["mfr;", "\u{1D52A}"],
  ["mho;", "\u2127"],
  ["micro", "\xB5"],
  ["micro;", "\xB5"],
  ["mid;", "\u2223"],
  ["midast;", "*"],
  ["midcir;", "\u2AF0"],
  ["middot", "\xB7"],
  ["middot;", "\xB7"],
  ["minus;", "\u2212"],
  ["minusb;", "\u229F"],
  ["minusd;", "\u2238"],
  ["minusdu;", "\u2A2A"],
  ["mlcp;", "\u2ADB"],
  ["mldr;", "\u2026"],
  ["mnplus;", "\u2213"],
  ["models;", "\u22A7"],
  ["mopf;", "\u{1D55E}"],
  ["mp;", "\u2213"],
  ["mscr;", "\u{1D4C2}"],
  ["mstpos;", "\u223E"],
  ["mu;", "\u03BC"],
  ["multimap;", "\u22B8"],
  ["mumap;", "\u22B8"],
  ["nGg;", "\u22D9\u0338"],
  ["nGt;", "\u226B\u20D2"],
  ["nGtv;", "\u226B\u0338"],
  ["nLeftarrow;", "\u21CD"],
  ["nLeftrightarrow;", "\u21CE"],
  ["nLl;", "\u22D8\u0338"],
  ["nLt;", "\u226A\u20D2"],
  ["nLtv;", "\u226A\u0338"],
  ["nRightarrow;", "\u21CF"],
  ["nVDash;", "\u22AF"],
  ["nVdash;", "\u22AE"],
  ["nabla;", "\u2207"],
  ["nacute;", "\u0144"],
  ["nang;", "\u2220\u20D2"],
  ["nap;", "\u2249"],
  ["napE;", "\u2A70\u0338"],
  ["napid;", "\u224B\u0338"],
  ["napos;", "\u0149"],
  ["napprox;", "\u2249"],
  ["natur;", "\u266E"],
  ["natural;", "\u266E"],
  ["naturals;", "\u2115"],
  ["nbsp", "\xA0"],
  ["nbsp;", "\xA0"],
  ["nbump;", "\u224E\u0338"],
  ["nbumpe;", "\u224F\u0338"],
  ["ncap;", "\u2A43"],
  ["ncaron;", "\u0148"],
  ["ncedil;", "\u0146"],
  ["ncong;", "\u2247"],
  ["ncongdot;", "\u2A6D\u0338"],
  ["ncup;", "\u2A42"],
  ["ncy;", "\u043D"],
  ["ndash;", "\u2013"],
  ["ne;", "\u2260"],
  ["neArr;", "\u21D7"],
  ["nearhk;", "\u2924"],
  ["nearr;", "\u2197"],
  ["nearrow;", "\u2197"],
  ["nedot;", "\u2250\u0338"],
  ["nequiv;", "\u2262"],
  ["nesear;", "\u2928"],
  ["nesim;", "\u2242\u0338"],
  ["nexist;", "\u2204"],
  ["nexists;", "\u2204"],
  ["nfr;", "\u{1D52B}"],
  ["ngE;", "\u2267\u0338"],
  ["nge;", "\u2271"],
  ["ngeq;", "\u2271"],
  ["ngeqq;", "\u2267\u0338"],
  ["ngeqslant;", "\u2A7E\u0338"],
  ["nges;", "\u2A7E\u0338"],
  ["ngsim;", "\u2275"],
  ["ngt;", "\u226F"],
  ["ngtr;", "\u226F"],
  ["nhArr;", "\u21CE"],
  ["nharr;", "\u21AE"],
  ["nhpar;", "\u2AF2"],
  ["ni;", "\u220B"],
  ["nis;", "\u22FC"],
  ["nisd;", "\u22FA"],
  ["niv;", "\u220B"],
  ["njcy;", "\u045A"],
  ["nlArr;", "\u21CD"],
  ["nlE;", "\u2266\u0338"],
  ["nlarr;", "\u219A"],
  ["nldr;", "\u2025"],
  ["nle;", "\u2270"],
  ["nleftarrow;", "\u219A"],
  ["nleftrightarrow;", "\u21AE"],
  ["nleq;", "\u2270"],
  ["nleqq;", "\u2266\u0338"],
  ["nleqslant;", "\u2A7D\u0338"],
  ["nles;", "\u2A7D\u0338"],
  ["nless;", "\u226E"],
  ["nlsim;", "\u2274"],
  ["nlt;", "\u226E"],
  ["nltri;", "\u22EA"],
  ["nltrie;", "\u22EC"],
  ["nmid;", "\u2224"],
  ["nopf;", "\u{1D55F}"],
  ["not", "\xAC"],
  ["not;", "\xAC"],
  ["notin;", "\u2209"],
  ["notinE;", "\u22F9\u0338"],
  ["notindot;", "\u22F5\u0338"],
  ["notinva;", "\u2209"],
  ["notinvb;", "\u22F7"],
  ["notinvc;", "\u22F6"],
  ["notni;", "\u220C"],
  ["notniva;", "\u220C"],
  ["notnivb;", "\u22FE"],
  ["notnivc;", "\u22FD"],
  ["npar;", "\u2226"],
  ["nparallel;", "\u2226"],
  ["nparsl;", "\u2AFD\u20E5"],
  ["npart;", "\u2202\u0338"],
  ["npolint;", "\u2A14"],
  ["npr;", "\u2280"],
  ["nprcue;", "\u22E0"],
  ["npre;", "\u2AAF\u0338"],
  ["nprec;", "\u2280"],
  ["npreceq;", "\u2AAF\u0338"],
  ["nrArr;", "\u21CF"],
  ["nrarr;", "\u219B"],
  ["nrarrc;", "\u2933\u0338"],
  ["nrarrw;", "\u219D\u0338"],
  ["nrightarrow;", "\u219B"],
  ["nrtri;", "\u22EB"],
  ["nrtrie;", "\u22ED"],
  ["nsc;", "\u2281"],
  ["nsccue;", "\u22E1"],
  ["nsce;", "\u2AB0\u0338"],
  ["nscr;", "\u{1D4C3}"],
  ["nshortmid;", "\u2224"],
  ["nshortparallel;", "\u2226"],
  ["nsim;", "\u2241"],
  ["nsime;", "\u2244"],
  ["nsimeq;", "\u2244"],
  ["nsmid;", "\u2224"],
  ["nspar;", "\u2226"],
  ["nsqsube;", "\u22E2"],
  ["nsqsupe;", "\u22E3"],
  ["nsub;", "\u2284"],
  ["nsubE;", "\u2AC5\u0338"],
  ["nsube;", "\u2288"],
  ["nsubset;", "\u2282\u20D2"],
  ["nsubseteq;", "\u2288"],
  ["nsubseteqq;", "\u2AC5\u0338"],
  ["nsucc;", "\u2281"],
  ["nsucceq;", "\u2AB0\u0338"],
  ["nsup;", "\u2285"],
  ["nsupE;", "\u2AC6\u0338"],
  ["nsupe;", "\u2289"],
  ["nsupset;", "\u2283\u20D2"],
  ["nsupseteq;", "\u2289"],
  ["nsupseteqq;", "\u2AC6\u0338"],
  ["ntgl;", "\u2279"],
  ["ntilde", "\xF1"],
  ["ntilde;", "\xF1"],
  ["ntlg;", "\u2278"],
  ["ntriangleleft;", "\u22EA"],
  ["ntrianglelefteq;", "\u22EC"],
  ["ntriangleright;", "\u22EB"],
  ["ntrianglerighteq;", "\u22ED"],
  ["nu;", "\u03BD"],
  ["num;", "#"],
  ["numero;", "\u2116"],
  ["numsp;", "\u2007"],
  ["nvDash;", "\u22AD"],
  ["nvHarr;", "\u2904"],
  ["nvap;", "\u224D\u20D2"],
  ["nvdash;", "\u22AC"],
  ["nvge;", "\u2265\u20D2"],
  ["nvgt;", ">\u20D2"],
  ["nvinfin;", "\u29DE"],
  ["nvlArr;", "\u2902"],
  ["nvle;", "\u2264\u20D2"],
  ["nvlt;", "<\u20D2"],
  ["nvltrie;", "\u22B4\u20D2"],
  ["nvrArr;", "\u2903"],
  ["nvrtrie;", "\u22B5\u20D2"],
  ["nvsim;", "\u223C\u20D2"],
  ["nwArr;", "\u21D6"],
  ["nwarhk;", "\u2923"],
  ["nwarr;", "\u2196"],
  ["nwarrow;", "\u2196"],
  ["nwnear;", "\u2927"],
  ["oS;", "\u24C8"],
  ["oacute", "\xF3"],
  ["oacute;", "\xF3"],
  ["oast;", "\u229B"],
  ["ocir;", "\u229A"],
  ["ocirc", "\xF4"],
  ["ocirc;", "\xF4"],
  ["ocy;", "\u043E"],
  ["odash;", "\u229D"],
  ["odblac;", "\u0151"],
  ["odiv;", "\u2A38"],
  ["odot;", "\u2299"],
  ["odsold;", "\u29BC"],
  ["oelig;", "\u0153"],
  ["ofcir;", "\u29BF"],
  ["ofr;", "\u{1D52C}"],
  ["ogon;", "\u02DB"],
  ["ograve", "\xF2"],
  ["ograve;", "\xF2"],
  ["ogt;", "\u29C1"],
  ["ohbar;", "\u29B5"],
  ["ohm;", "\u03A9"],
  ["oint;", "\u222E"],
  ["olarr;", "\u21BA"],
  ["olcir;", "\u29BE"],
  ["olcross;", "\u29BB"],
  ["oline;", "\u203E"],
  ["olt;", "\u29C0"],
  ["omacr;", "\u014D"],
  ["omega;", "\u03C9"],
  ["omicron;", "\u03BF"],
  ["omid;", "\u29B6"],
  ["ominus;", "\u2296"],
  ["oopf;", "\u{1D560}"],
  ["opar;", "\u29B7"],
  ["operp;", "\u29B9"],
  ["oplus;", "\u2295"],
  ["or;", "\u2228"],
  ["orarr;", "\u21BB"],
  ["ord;", "\u2A5D"],
  ["order;", "\u2134"],
  ["orderof;", "\u2134"],
  ["ordf", "\xAA"],
  ["ordf;", "\xAA"],
  ["ordm", "\xBA"],
  ["ordm;", "\xBA"],
  ["origof;", "\u22B6"],
  ["oror;", "\u2A56"],
  ["orslope;", "\u2A57"],
  ["orv;", "\u2A5B"],
  ["oscr;", "\u2134"],
  ["oslash", "\xF8"],
  ["oslash;", "\xF8"],
  ["osol;", "\u2298"],
  ["otilde", "\xF5"],
  ["otilde;", "\xF5"],
  ["otimes;", "\u2297"],
  ["otimesas;", "\u2A36"],
  ["ouml", "\xF6"],
  ["ouml;", "\xF6"],
  ["ovbar;", "\u233D"],
  ["par;", "\u2225"],
  ["para", "\xB6"],
  ["para;", "\xB6"],
  ["parallel;", "\u2225"],
  ["parsim;", "\u2AF3"],
  ["parsl;", "\u2AFD"],
  ["part;", "\u2202"],
  ["pcy;", "\u043F"],
  ["percnt;", "%"],
  ["period;", "."],
  ["permil;", "\u2030"],
  ["perp;", "\u22A5"],
  ["pertenk;", "\u2031"],
  ["pfr;", "\u{1D52D}"],
  ["phi;", "\u03C6"],
  ["phiv;", "\u03D5"],
  ["phmmat;", "\u2133"],
  ["phone;", "\u260E"],
  ["pi;", "\u03C0"],
  ["pitchfork;", "\u22D4"],
  ["piv;", "\u03D6"],
  ["planck;", "\u210F"],
  ["planckh;", "\u210E"],
  ["plankv;", "\u210F"],
  ["plus;", "+"],
  ["plusacir;", "\u2A23"],
  ["plusb;", "\u229E"],
  ["pluscir;", "\u2A22"],
  ["plusdo;", "\u2214"],
  ["plusdu;", "\u2A25"],
  ["pluse;", "\u2A72"],
  ["plusmn", "\xB1"],
  ["plusmn;", "\xB1"],
  ["plussim;", "\u2A26"],
  ["plustwo;", "\u2A27"],
  ["pm;", "\xB1"],
  ["pointint;", "\u2A15"],
  ["popf;", "\u{1D561}"],
  ["pound", "\xA3"],
  ["pound;", "\xA3"],
  ["pr;", "\u227A"],
  ["prE;", "\u2AB3"],
  ["prap;", "\u2AB7"],
  ["prcue;", "\u227C"],
  ["pre;", "\u2AAF"],
  ["prec;", "\u227A"],
  ["precapprox;", "\u2AB7"],
  ["preccurlyeq;", "\u227C"],
  ["preceq;", "\u2AAF"],
  ["precnapprox;", "\u2AB9"],
  ["precneqq;", "\u2AB5"],
  ["precnsim;", "\u22E8"],
  ["precsim;", "\u227E"],
  ["prime;", "\u2032"],
  ["primes;", "\u2119"],
  ["prnE;", "\u2AB5"],
  ["prnap;", "\u2AB9"],
  ["prnsim;", "\u22E8"],
  ["prod;", "\u220F"],
  ["profalar;", "\u232E"],
  ["profline;", "\u2312"],
  ["profsurf;", "\u2313"],
  ["prop;", "\u221D"],
  ["propto;", "\u221D"],
  ["prsim;", "\u227E"],
  ["prurel;", "\u22B0"],
  ["pscr;", "\u{1D4C5}"],
  ["psi;", "\u03C8"],
  ["puncsp;", "\u2008"],
  ["qfr;", "\u{1D52E}"],
  ["qint;", "\u2A0C"],
  ["qopf;", "\u{1D562}"],
  ["qprime;", "\u2057"],
  ["qscr;", "\u{1D4C6}"],
  ["quaternions;", "\u210D"],
  ["quatint;", "\u2A16"],
  ["quest;", "?"],
  ["questeq;", "\u225F"],
  ["quot", '"'],
  ["quot;", '"'],
  ["rAarr;", "\u21DB"],
  ["rArr;", "\u21D2"],
  ["rAtail;", "\u291C"],
  ["rBarr;", "\u290F"],
  ["rHar;", "\u2964"],
  ["race;", "\u223D\u0331"],
  ["racute;", "\u0155"],
  ["radic;", "\u221A"],
  ["raemptyv;", "\u29B3"],
  ["rang;", "\u27E9"],
  ["rangd;", "\u2992"],
  ["range;", "\u29A5"],
  ["rangle;", "\u27E9"],
  ["raquo", "\xBB"],
  ["raquo;", "\xBB"],
  ["rarr;", "\u2192"],
  ["rarrap;", "\u2975"],
  ["rarrb;", "\u21E5"],
  ["rarrbfs;", "\u2920"],
  ["rarrc;", "\u2933"],
  ["rarrfs;", "\u291E"],
  ["rarrhk;", "\u21AA"],
  ["rarrlp;", "\u21AC"],
  ["rarrpl;", "\u2945"],
  ["rarrsim;", "\u2974"],
  ["rarrtl;", "\u21A3"],
  ["rarrw;", "\u219D"],
  ["ratail;", "\u291A"],
  ["ratio;", "\u2236"],
  ["rationals;", "\u211A"],
  ["rbarr;", "\u290D"],
  ["rbbrk;", "\u2773"],
  ["rbrace;", "}"],
  ["rbrack;", "]"],
  ["rbrke;", "\u298C"],
  ["rbrksld;", "\u298E"],
  ["rbrkslu;", "\u2990"],
  ["rcaron;", "\u0159"],
  ["rcedil;", "\u0157"],
  ["rceil;", "\u2309"],
  ["rcub;", "}"],
  ["rcy;", "\u0440"],
  ["rdca;", "\u2937"],
  ["rdldhar;", "\u2969"],
  ["rdquo;", "\u201D"],
  ["rdquor;", "\u201D"],
  ["rdsh;", "\u21B3"],
  ["real;", "\u211C"],
  ["realine;", "\u211B"],
  ["realpart;", "\u211C"],
  ["reals;", "\u211D"],
  ["rect;", "\u25AD"],
  ["reg", "\xAE"],
  ["reg;", "\xAE"],
  ["rfisht;", "\u297D"],
  ["rfloor;", "\u230B"],
  ["rfr;", "\u{1D52F}"],
  ["rhard;", "\u21C1"],
  ["rharu;", "\u21C0"],
  ["rharul;", "\u296C"],
  ["rho;", "\u03C1"],
  ["rhov;", "\u03F1"],
  ["rightarrow;", "\u2192"],
  ["rightarrowtail;", "\u21A3"],
  ["rightharpoondown;", "\u21C1"],
  ["rightharpoonup;", "\u21C0"],
  ["rightleftarrows;", "\u21C4"],
  ["rightleftharpoons;", "\u21CC"],
  ["rightrightarrows;", "\u21C9"],
  ["rightsquigarrow;", "\u219D"],
  ["rightthreetimes;", "\u22CC"],
  ["ring;", "\u02DA"],
  ["risingdotseq;", "\u2253"],
  ["rlarr;", "\u21C4"],
  ["rlhar;", "\u21CC"],
  ["rlm;", "\u200F"],
  ["rmoust;", "\u23B1"],
  ["rmoustache;", "\u23B1"],
  ["rnmid;", "\u2AEE"],
  ["roang;", "\u27ED"],
  ["roarr;", "\u21FE"],
  ["robrk;", "\u27E7"],
  ["ropar;", "\u2986"],
  ["ropf;", "\u{1D563}"],
  ["roplus;", "\u2A2E"],
  ["rotimes;", "\u2A35"],
  ["rpar;", ")"],
  ["rpargt;", "\u2994"],
  ["rppolint;", "\u2A12"],
  ["rrarr;", "\u21C9"],
  ["rsaquo;", "\u203A"],
  ["rscr;", "\u{1D4C7}"],
  ["rsh;", "\u21B1"],
  ["rsqb;", "]"],
  ["rsquo;", "\u2019"],
  ["rsquor;", "\u2019"],
  ["rthree;", "\u22CC"],
  ["rtimes;", "\u22CA"],
  ["rtri;", "\u25B9"],
  ["rtrie;", "\u22B5"],
  ["rtrif;", "\u25B8"],
  ["rtriltri;", "\u29CE"],
  ["ruluhar;", "\u2968"],
  ["rx;", "\u211E"],
  ["sacute;", "\u015B"],
  ["sbquo;", "\u201A"],
  ["sc;", "\u227B"],
  ["scE;", "\u2AB4"],
  ["scap;", "\u2AB8"],
  ["scaron;", "\u0161"],
  ["sccue;", "\u227D"],
  ["sce;", "\u2AB0"],
  ["scedil;", "\u015F"],
  ["scirc;", "\u015D"],
  ["scnE;", "\u2AB6"],
  ["scnap;", "\u2ABA"],
  ["scnsim;", "\u22E9"],
  ["scpolint;", "\u2A13"],
  ["scsim;", "\u227F"],
  ["scy;", "\u0441"],
  ["sdot;", "\u22C5"],
  ["sdotb;", "\u22A1"],
  ["sdote;", "\u2A66"],
  ["seArr;", "\u21D8"],
  ["searhk;", "\u2925"],
  ["searr;", "\u2198"],
  ["searrow;", "\u2198"],
  ["sect", "\xA7"],
  ["sect;", "\xA7"],
  ["semi;", ";"],
  ["seswar;", "\u2929"],
  ["setminus;", "\u2216"],
  ["setmn;", "\u2216"],
  ["sext;", "\u2736"],
  ["sfr;", "\u{1D530}"],
  ["sfrown;", "\u2322"],
  ["sharp;", "\u266F"],
  ["shchcy;", "\u0449"],
  ["shcy;", "\u0448"],
  ["shortmid;", "\u2223"],
  ["shortparallel;", "\u2225"],
  ["shy", "\xAD"],
  ["shy;", "\xAD"],
  ["sigma;", "\u03C3"],
  ["sigmaf;", "\u03C2"],
  ["sigmav;", "\u03C2"],
  ["sim;", "\u223C"],
  ["simdot;", "\u2A6A"],
  ["sime;", "\u2243"],
  ["simeq;", "\u2243"],
  ["simg;", "\u2A9E"],
  ["simgE;", "\u2AA0"],
  ["siml;", "\u2A9D"],
  ["simlE;", "\u2A9F"],
  ["simne;", "\u2246"],
  ["simplus;", "\u2A24"],
  ["simrarr;", "\u2972"],
  ["slarr;", "\u2190"],
  ["smallsetminus;", "\u2216"],
  ["smashp;", "\u2A33"],
  ["smeparsl;", "\u29E4"],
  ["smid;", "\u2223"],
  ["smile;", "\u2323"],
  ["smt;", "\u2AAA"],
  ["smte;", "\u2AAC"],
  ["smtes;", "\u2AAC\uFE00"],
  ["softcy;", "\u044C"],
  ["sol;", "/"],
  ["solb;", "\u29C4"],
  ["solbar;", "\u233F"],
  ["sopf;", "\u{1D564}"],
  ["spades;", "\u2660"],
  ["spadesuit;", "\u2660"],
  ["spar;", "\u2225"],
  ["sqcap;", "\u2293"],
  ["sqcaps;", "\u2293\uFE00"],
  ["sqcup;", "\u2294"],
  ["sqcups;", "\u2294\uFE00"],
  ["sqsub;", "\u228F"],
  ["sqsube;", "\u2291"],
  ["sqsubset;", "\u228F"],
  ["sqsubseteq;", "\u2291"],
  ["sqsup;", "\u2290"],
  ["sqsupe;", "\u2292"],
  ["sqsupset;", "\u2290"],
  ["sqsupseteq;", "\u2292"],
  ["squ;", "\u25A1"],
  ["square;", "\u25A1"],
  ["squarf;", "\u25AA"],
  ["squf;", "\u25AA"],
  ["srarr;", "\u2192"],
  ["sscr;", "\u{1D4C8}"],
  ["ssetmn;", "\u2216"],
  ["ssmile;", "\u2323"],
  ["sstarf;", "\u22C6"],
  ["star;", "\u2606"],
  ["starf;", "\u2605"],
  ["straightepsilon;", "\u03F5"],
  ["straightphi;", "\u03D5"],
  ["strns;", "\xAF"],
  ["sub;", "\u2282"],
  ["subE;", "\u2AC5"],
  ["subdot;", "\u2ABD"],
  ["sube;", "\u2286"],
  ["subedot;", "\u2AC3"],
  ["submult;", "\u2AC1"],
  ["subnE;", "\u2ACB"],
  ["subne;", "\u228A"],
  ["subplus;", "\u2ABF"],
  ["subrarr;", "\u2979"],
  ["subset;", "\u2282"],
  ["subseteq;", "\u2286"],
  ["subseteqq;", "\u2AC5"],
  ["subsetneq;", "\u228A"],
  ["subsetneqq;", "\u2ACB"],
  ["subsim;", "\u2AC7"],
  ["subsub;", "\u2AD5"],
  ["subsup;", "\u2AD3"],
  ["succ;", "\u227B"],
  ["succapprox;", "\u2AB8"],
  ["succcurlyeq;", "\u227D"],
  ["succeq;", "\u2AB0"],
  ["succnapprox;", "\u2ABA"],
  ["succneqq;", "\u2AB6"],
  ["succnsim;", "\u22E9"],
  ["succsim;", "\u227F"],
  ["sum;", "\u2211"],
  ["sung;", "\u266A"],
  ["sup1", "\xB9"],
  ["sup1;", "\xB9"],
  ["sup2", "\xB2"],
  ["sup2;", "\xB2"],
  ["sup3", "\xB3"],
  ["sup3;", "\xB3"],
  ["sup;", "\u2283"],
  ["supE;", "\u2AC6"],
  ["supdot;", "\u2ABE"],
  ["supdsub;", "\u2AD8"],
  ["supe;", "\u2287"],
  ["supedot;", "\u2AC4"],
  ["suphsol;", "\u27C9"],
  ["suphsub;", "\u2AD7"],
  ["suplarr;", "\u297B"],
  ["supmult;", "\u2AC2"],
  ["supnE;", "\u2ACC"],
  ["supne;", "\u228B"],
  ["supplus;", "\u2AC0"],
  ["supset;", "\u2283"],
  ["supseteq;", "\u2287"],
  ["supseteqq;", "\u2AC6"],
  ["supsetneq;", "\u228B"],
  ["supsetneqq;", "\u2ACC"],
  ["supsim;", "\u2AC8"],
  ["supsub;", "\u2AD4"],
  ["supsup;", "\u2AD6"],
  ["swArr;", "\u21D9"],
  ["swarhk;", "\u2926"],
  ["swarr;", "\u2199"],
  ["swarrow;", "\u2199"],
  ["swnwar;", "\u292A"],
  ["szlig", "\xDF"],
  ["szlig;", "\xDF"],
  ["target;", "\u2316"],
  ["tau;", "\u03C4"],
  ["tbrk;", "\u23B4"],
  ["tcaron;", "\u0165"],
  ["tcedil;", "\u0163"],
  ["tcy;", "\u0442"],
  ["tdot;", "\u20DB"],
  ["telrec;", "\u2315"],
  ["tfr;", "\u{1D531}"],
  ["there4;", "\u2234"],
  ["therefore;", "\u2234"],
  ["theta;", "\u03B8"],
  ["thetasym;", "\u03D1"],
  ["thetav;", "\u03D1"],
  ["thickapprox;", "\u2248"],
  ["thicksim;", "\u223C"],
  ["thinsp;", "\u2009"],
  ["thkap;", "\u2248"],
  ["thksim;", "\u223C"],
  ["thorn", "\xFE"],
  ["thorn;", "\xFE"],
  ["tilde;", "\u02DC"],
  ["times", "\xD7"],
  ["times;", "\xD7"],
  ["timesb;", "\u22A0"],
  ["timesbar;", "\u2A31"],
  ["timesd;", "\u2A30"],
  ["tint;", "\u222D"],
  ["toea;", "\u2928"],
  ["top;", "\u22A4"],
  ["topbot;", "\u2336"],
  ["topcir;", "\u2AF1"],
  ["topf;", "\u{1D565}"],
  ["topfork;", "\u2ADA"],
  ["tosa;", "\u2929"],
  ["tprime;", "\u2034"],
  ["trade;", "\u2122"],
  ["triangle;", "\u25B5"],
  ["triangledown;", "\u25BF"],
  ["triangleleft;", "\u25C3"],
  ["trianglelefteq;", "\u22B4"],
  ["triangleq;", "\u225C"],
  ["triangleright;", "\u25B9"],
  ["trianglerighteq;", "\u22B5"],
  ["tridot;", "\u25EC"],
  ["trie;", "\u225C"],
  ["triminus;", "\u2A3A"],
  ["triplus;", "\u2A39"],
  ["trisb;", "\u29CD"],
  ["tritime;", "\u2A3B"],
  ["trpezium;", "\u23E2"],
  ["tscr;", "\u{1D4C9}"],
  ["tscy;", "\u0446"],
  ["tshcy;", "\u045B"],
  ["tstrok;", "\u0167"],
  ["twixt;", "\u226C"],
  ["twoheadleftarrow;", "\u219E"],
  ["twoheadrightarrow;", "\u21A0"],
  ["uArr;", "\u21D1"],
  ["uHar;", "\u2963"],
  ["uacute", "\xFA"],
  ["uacute;", "\xFA"],
  ["uarr;", "\u2191"],
  ["ubrcy;", "\u045E"],
  ["ubreve;", "\u016D"],
  ["ucirc", "\xFB"],
  ["ucirc;", "\xFB"],
  ["ucy;", "\u0443"],
  ["udarr;", "\u21C5"],
  ["udblac;", "\u0171"],
  ["udhar;", "\u296E"],
  ["ufisht;", "\u297E"],
  ["ufr;", "\u{1D532}"],
  ["ugrave", "\xF9"],
  ["ugrave;", "\xF9"],
  ["uharl;", "\u21BF"],
  ["uharr;", "\u21BE"],
  ["uhblk;", "\u2580"],
  ["ulcorn;", "\u231C"],
  ["ulcorner;", "\u231C"],
  ["ulcrop;", "\u230F"],
  ["ultri;", "\u25F8"],
  ["umacr;", "\u016B"],
  ["uml", "\xA8"],
  ["uml;", "\xA8"],
  ["uogon;", "\u0173"],
  ["uopf;", "\u{1D566}"],
  ["uparrow;", "\u2191"],
  ["updownarrow;", "\u2195"],
  ["upharpoonleft;", "\u21BF"],
  ["upharpoonright;", "\u21BE"],
  ["uplus;", "\u228E"],
  ["upsi;", "\u03C5"],
  ["upsih;", "\u03D2"],
  ["upsilon;", "\u03C5"],
  ["upuparrows;", "\u21C8"],
  ["urcorn;", "\u231D"],
  ["urcorner;", "\u231D"],
  ["urcrop;", "\u230E"],
  ["uring;", "\u016F"],
  ["urtri;", "\u25F9"],
  ["uscr;", "\u{1D4CA}"],
  ["utdot;", "\u22F0"],
  ["utilde;", "\u0169"],
  ["utri;", "\u25B5"],
  ["utrif;", "\u25B4"],
  ["uuarr;", "\u21C8"],
  ["uuml", "\xFC"],
  ["uuml;", "\xFC"],
  ["uwangle;", "\u29A7"],
  ["vArr;", "\u21D5"],
  ["vBar;", "\u2AE8"],
  ["vBarv;", "\u2AE9"],
  ["vDash;", "\u22A8"],
  ["vangrt;", "\u299C"],
  ["varepsilon;", "\u03F5"],
  ["varkappa;", "\u03F0"],
  ["varnothing;", "\u2205"],
  ["varphi;", "\u03D5"],
  ["varpi;", "\u03D6"],
  ["varpropto;", "\u221D"],
  ["varr;", "\u2195"],
  ["varrho;", "\u03F1"],
  ["varsigma;", "\u03C2"],
  ["varsubsetneq;", "\u228A\uFE00"],
  ["varsubsetneqq;", "\u2ACB\uFE00"],
  ["varsupsetneq;", "\u228B\uFE00"],
  ["varsupsetneqq;", "\u2ACC\uFE00"],
  ["vartheta;", "\u03D1"],
  ["vartriangleleft;", "\u22B2"],
  ["vartriangleright;", "\u22B3"],
  ["vcy;", "\u0432"],
  ["vdash;", "\u22A2"],
  ["vee;", "\u2228"],
  ["veebar;", "\u22BB"],
  ["veeeq;", "\u225A"],
  ["vellip;", "\u22EE"],
  ["verbar;", "|"],
  ["vert;", "|"],
  ["vfr;", "\u{1D533}"],
  ["vltri;", "\u22B2"],
  ["vnsub;", "\u2282\u20D2"],
  ["vnsup;", "\u2283\u20D2"],
  ["vopf;", "\u{1D567}"],
  ["vprop;", "\u221D"],
  ["vrtri;", "\u22B3"],
  ["vscr;", "\u{1D4CB}"],
  ["vsubnE;", "\u2ACB\uFE00"],
  ["vsubne;", "\u228A\uFE00"],
  ["vsupnE;", "\u2ACC\uFE00"],
  ["vsupne;", "\u228B\uFE00"],
  ["vzigzag;", "\u299A"],
  ["wcirc;", "\u0175"],
  ["wedbar;", "\u2A5F"],
  ["wedge;", "\u2227"],
  ["wedgeq;", "\u2259"],
  ["weierp;", "\u2118"],
  ["wfr;", "\u{1D534}"],
  ["wopf;", "\u{1D568}"],
  ["wp;", "\u2118"],
  ["wr;", "\u2240"],
  ["wreath;", "\u2240"],
  ["wscr;", "\u{1D4CC}"],
  ["xcap;", "\u22C2"],
  ["xcirc;", "\u25EF"],
  ["xcup;", "\u22C3"],
  ["xdtri;", "\u25BD"],
  ["xfr;", "\u{1D535}"],
  ["xhArr;", "\u27FA"],
  ["xharr;", "\u27F7"],
  ["xi;", "\u03BE"],
  ["xlArr;", "\u27F8"],
  ["xlarr;", "\u27F5"],
  ["xmap;", "\u27FC"],
  ["xnis;", "\u22FB"],
  ["xodot;", "\u2A00"],
  ["xopf;", "\u{1D569}"],
  ["xoplus;", "\u2A01"],
  ["xotime;", "\u2A02"],
  ["xrArr;", "\u27F9"],
  ["xrarr;", "\u27F6"],
  ["xscr;", "\u{1D4CD}"],
  ["xsqcup;", "\u2A06"],
  ["xuplus;", "\u2A04"],
  ["xutri;", "\u25B3"],
  ["xvee;", "\u22C1"],
  ["xwedge;", "\u22C0"],
  ["yacute", "\xFD"],
  ["yacute;", "\xFD"],
  ["yacy;", "\u044F"],
  ["ycirc;", "\u0177"],
  ["ycy;", "\u044B"],
  ["yen", "\xA5"],
  ["yen;", "\xA5"],
  ["yfr;", "\u{1D536}"],
  ["yicy;", "\u0457"],
  ["yopf;", "\u{1D56A}"],
  ["yscr;", "\u{1D4CE}"],
  ["yucy;", "\u044E"],
  ["yuml", "\xFF"],
  ["yuml;", "\xFF"],
  ["zacute;", "\u017A"],
  ["zcaron;", "\u017E"],
  ["zcy;", "\u0437"],
  ["zdot;", "\u017C"],
  ["zeetrf;", "\u2128"],
  ["zeta;", "\u03B6"],
  ["zfr;", "\u{1D537}"],
  ["zhcy;", "\u0436"],
  ["zigrarr;", "\u21DD"],
  ["zopf;", "\u{1D56B}"],
  ["zscr;", "\u{1D4CF}"],
  ["zwj;", "\u200D"],
  ["zwnj;", "\u200C"]
]);
var HTML_NUMERIC_REMAP = /* @__PURE__ */ new Map([
  [128, "\u20AC"],
  [130, "\u201A"],
  [131, "\u0192"],
  [132, "\u201E"],
  [133, "\u2026"],
  [134, "\u2020"],
  [135, "\u2021"],
  [136, "\u02C6"],
  [137, "\u2030"],
  [138, "\u0160"],
  [139, "\u2039"],
  [140, "\u0152"],
  [142, "\u017D"],
  [145, "\u2018"],
  [146, "\u2019"],
  [147, "\u201C"],
  [148, "\u201D"],
  [149, "\u2022"],
  [150, "\u2013"],
  [151, "\u2014"],
  [152, "\u02DC"],
  [153, "\u2122"],
  [154, "\u0161"],
  [155, "\u203A"],
  [156, "\u0153"],
  [158, "\u017E"],
  [159, "\u0178"]
]);

// src/match-engine.ts
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
function compileMatcher(entry) {
  const caseSensitive = entry.matchType === "word";
  const flags = caseSensitive ? "g" : "gi";
  const tokenPattern = entry.forms.map((f) => compileFormPattern(f, entry.matchType)).join("|");
  const compoundRegexes = entry.allowedContexts.filter((c) => c.kind === "compound").map((c) => new RegExp(compilePhrasePattern(c.pattern), "gi"));
  const negation = entry.allowedContexts.find((c) => c.kind === "negation");
  return {
    tokenRegex: new RegExp(tokenPattern, flags),
    compoundRegexes,
    hasNegation: Boolean(negation),
    negationProximity: negation?.proximity ?? DEFAULT_NEGATION_PROXIMITY,
    listNegationProximity: DEFAULT_LIST_NEGATION_PROXIMITY,
    hasDisclaimer: entry.allowedContexts.some((c) => c.kind === "disclaimer-banner")
  };
}
var HTML_TAG_RE = /<[^>]*>/g;
var HTML_ENTITY_RE = /&(?:#[xX]([0-9a-fA-F]+);?|#([0-9]+);?|([A-Za-z][A-Za-z0-9]{0,31})(;?))/g;
var READS_AS_SPACE_RE = /[\p{Zs}\p{Cc}\p{Cf}]/gu;
function codePointOf(digits, base) {
  const significant = digits.replace(/^0+/, "");
  if (significant.length > (base === 16 ? 6 : 7)) return 1114112;
  return significant === "" ? 0 : parseInt(significant, base);
}
function numericEntityChars(codePoint) {
  if (codePoint === 0 || codePoint > 1114111 || codePoint >= 55296 && codePoint <= 57343) {
    return "\uFFFD";
  }
  return HTML_NUMERIC_REMAP.get(codePoint) ?? String.fromCodePoint(codePoint);
}
function namedEntity(name, semicolon) {
  const full = semicolon ? HTML_NAMED_ENTITIES.get(`${name};`) : void 0;
  if (full !== void 0) return { length: name.length + 2, chars: full };
  for (let n = name.length; n >= 2; n--) {
    const chars = HTML_NAMED_ENTITIES.get(name.slice(0, n));
    if (chars !== void 0) return { length: n + 1, chars };
  }
  return null;
}
function decodedRun(length, chars) {
  const shown = chars.replace(READS_AS_SPACE_RE, " ");
  return shown.length > length ? null : " ".repeat(length - shown.length) + shown;
}
function maskHtml(text) {
  return text.replace(HTML_TAG_RE, (m) => " ".repeat(m.length)).replace(HTML_ENTITY_RE, (m, hex, dec, name, semi) => {
    if (name === void 0) {
      const run2 = decodedRun(m.length, numericEntityChars(hex !== void 0 ? codePointOf(hex, 16) : codePointOf(dec, 10)));
      return run2 ?? m;
    }
    const entity = namedEntity(name, semi === ";");
    if (entity === null) return m;
    const run = decodedRun(entity.length, entity.chars);
    return run === null ? m : run + m.slice(entity.length);
  });
}
function indexWords(masked) {
  const words2 = [];
  const re = /[A-Za-z0-9'‘’]+/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    words2.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return words2;
}
function wordIndexForMatch(words2, offset) {
  for (let i = 0; i < words2.length; i++) {
    if (offset < words2[i].end) return i;
  }
  return words2.length;
}
function isNegated(masked, words2, matchOffset, proximity, listProximity) {
  const w = wordIndexForMatch(words2, matchOffset);
  let sawCoordinator = false;
  const floor = Math.max(0, w - listProximity);
  for (let j = w - 1; j >= floor; j--) {
    const next = words2[j + 1];
    const rightEdge = next ? next.start : matchOffset;
    const gap = masked.slice(words2[j].end, rightEdge);
    if (SENTENCE_TERMINATOR.test(gap)) break;
    if (gap.includes(",")) sawCoordinator = true;
    const cue = normalizeApostrophe(words2[j].text.toLowerCase()).replace(/^'+|'+$/g, "");
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
function runMatcher(compiled, text, masked, words2, disclaimerRanges) {
  const out = [];
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
    if (compiled.hasDisclaimer && withinAnyRange(index, disclaimerRanges)) continue;
    if (compiled.hasNegation && isNegated(masked, words2, index, compiled.negationProximity, compiled.listNegationProximity)) {
      continue;
    }
    out.push({ index, matchedText });
  }
  return out;
}

// src/check.ts
var COMPILED = COMPLIANCE_REGISTRY.map((entry) => ({
  entry,
  matcher: compileMatcher(entry)
}));
function buildMessage(entry, matchedText, index) {
  const base = `\u2717 ${entry.category}: "${matchedText}" is M7 prohibited language ("${entry.token}") at offset ${index}`;
  return entry.suggest ? `${base} \u2192 use "${entry.suggest}" instead` : base;
}
function checkCompliance(text, opts = {}) {
  if (typeof text !== "string" || text.length === 0) return [];
  const masked = maskHtml(text);
  const words2 = indexWords(masked);
  const violations = [];
  for (const { entry, matcher } of COMPILED) {
    for (const { index, matchedText } of runMatcher(matcher, text, masked, words2, opts.disclaimerRanges)) {
      violations.push({
        token: entry.token,
        category: entry.category,
        index,
        matchedText,
        suggest: entry.suggest,
        message: buildMessage(entry, matchedText, index)
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

// src/lanes/index.ts
var NEGATION2 = {
  kind: "negation",
  pattern: "negation cue (not|never|no|isn't|won't\u2026) within proximity words before the match, same clause",
  note: "A negated / NOT-THAT use is in-lane meta-copy, not a cross-lane act. E.g. an agent writing 'I am not your loan officer and cannot lock your rate \u2014 talk to your MLO' names the wrong-lane phrase only to disclaim it. Same affirmative-vs-NOT-THAT rule as M7."
};
var DISCLAIMER2 = {
  kind: "disclaimer-banner",
  pattern: "match offset within a caller-supplied disclaimerRanges block",
  note: "An explicitly-marked educational/referral disclaimer block (e.g. 'For loan questions, your loan officer can help you apply for a loan and lock your rate.') legitimately names the other lane's actions when steering the recipient TO that professional. The caller marks the range; fail-safe-strict if it does not."
};
var OWN_RATE = {
  kind: "own-rate",
  pattern: "OWN_RATE_CUES near the match AND no OFFER_CUES (shared rate-claims regexes)",
  note: "Lead-owned-rate escape (Kelly ruling 2026-06-03). A factual reference to the lead's OWN existing rate ('your current rate is 2.88%', 'your rate is still one of the best', 'you're sitting on a 2.94% rate', 'your 6.5% rate alert') is not a rate OFFER \u2014 outside the cross-lane scope. Excused IFF the shared OWN_RATE_CUES fire within OWN_RATE_WINDOW of the match AND no shared OFFER_CUES are present (a prospective 'your new rate could be 5.5%' / 'your rate will be 5.5%' / 'I can offer you a rate of \u2026' STILL flags). Mirrors rate-claims scanRegZ and reuses its exact OWN_RATE_CUES/OFFER_CUES regexes (single source of truth)."
};
var LANE_REGISTRY = [
  // ════════════════════════════════════════════════════════════════════════
  // AGENT_LANE_VIOLATION — MLO-only language an AGENT must not use.
  // ════════════════════════════════════════════════════════════════════════
  {
    token: "rate offer",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    // A possessive/offer-framed rate QUOTE. The framing word ("your"/"a special"/
    // "we can offer you"/"I can get you"/"lock in") is REQUIRED so a bare market-
    // rate statement is not caught (see rationale).
    forms: [
      "your rate will be",
      "your rate is",
      "your interest rate will be",
      "your interest rate is",
      "we can offer you a rate",
      "we can offer you a rate of",
      "i can offer you a rate",
      "i can get you a rate",
      "we'll give you a rate",
      "i'll give you a rate",
      "a special rate of",
      "an exclusive rate of",
      "your rate would be"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2, OWN_RATE],
    rationale: "Quoting a SPECIFIC interest rate as a personal offer is loan origination \u2014 an MLO act under the SAFE Act. Forbidden for an agent. DELIBERATELY NOT CAUGHT (false-positive guards): general market context an agent may freely cite \u2014 'today's 30-year rates are around 6% per Freddie Mac', 'rates have come down', 'when rates drop you may want to refinance', 'ask your loan officer about current rates'. Only the possessive/first-person OFFER framing ('your rate is\u2026', 'we can offer you a rate of\u2026') trips this row. OWN-RATE ESCAPE (v0.5.0, Kelly ruling 2026-06-03 \u2014 mirrors the rate-claims scanRegZ carve-out so the two scanners agree): a FACTUAL reference to the lead's OWN existing rate is NOT an offer and is excused \u2014 'your current rate is 2.88%', 'your rate is still one of the best out there', 'you're sitting on a 2.94% rate', 'your 6.5% rate alert' do NOT flag (own-rate cue near the match, no prospective-offer cue). A PROSPECTIVE offer under a possessive 'your' STILL flags \u2014 'your rate will be 5.5%', 'your new rate could be 5.5%', 'I can offer you a rate of \u2026' (the shared OFFER_CUES override). Uses the exact OWN_RATE_CUES/OFFER_CUES regexes imported from rate-claims (single source of truth).",
    suggest: "refer the recipient to their loan officer for any rate quote"
  },
  {
    token: "you qualify for",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "you qualify for a rate",
      "you qualify for a rate of",
      "you qualify for a loan",
      "you qualify for a mortgage",
      "you qualify for financing",
      "you qualify for a loan amount",
      "you qualify for up to",
      "you qualify for a lower rate",
      "you'll qualify for a loan",
      "you may qualify for a loan",
      "you may qualify for a mortgage",
      "you pre-qualify for a loan"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Telling a consumer they 'qualify for' a loan / a rate / a loan amount is a credit-eligibility determination \u2014 an MLO act. Forbidden for an agent. DELIBERATELY NOT CAUGHT: non-loan eligibility an agent legitimately discusses \u2014 'you qualify for a property-tax exemption', 'homes that qualify for this program', 'you qualify for our VIP buyer list'. Only loan/mortgage/rate/financing qualification framing trips this row.",
    suggest: "refer the recipient to their loan officer to discuss loan eligibility"
  },
  {
    token: "approved for a loan",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "you're approved for a loan",
      "you are approved for a loan",
      "you're approved for a mortgage",
      "you are approved for a mortgage",
      "you're pre-approved",
      "you are pre-approved",
      "you're pre-approved for a loan",
      "you are pre-approved for a loan",
      "you're pre-approved for a mortgage",
      "you are pre-approved for a mortgage",
      "i can get you approved",
      "we can get you approved",
      "you've been approved for financing",
      "you have been approved for financing"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Stating that a consumer is 'approved' or 'pre-approved' for a loan/mortgage is a credit decision \u2014 an MLO/lender act. Forbidden for an agent. (Note: M7 also blocks bare borrower-facing 'approved' claims; this lane row is the role-scoped, MLO-only sense \u2014 distinct gate.) DELIBERATELY NOT CAUGHT: non-loan approvals an agent handles \u2014 'your offer was approved by the seller', 'the HOA approved your application', 'HUD-approved counselor' (M7 compound). Only loan/mortgage/financing pre-approval framing trips this row.",
    suggest: "refer the recipient to their loan officer for any pre-approval"
  },
  {
    token: "lock your rate",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "lock your rate",
      "lock in your rate",
      "lock your interest rate",
      "lock in your interest rate",
      "let's lock your rate",
      "we can lock your rate",
      "i can lock your rate",
      "lock your rate today",
      "lock in a low rate",
      "lock in a great rate"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Offering to lock a borrower's interest rate is a loan-origination act controlled by the lender/MLO. Forbidden for an agent. (M7 also blocks the bare borrower-facing 'lock' claim; this is the role-scoped sense.) DELIBERATELY NOT CAUGHT: unrelated 'lock' uses \u2014 'lock the front door at a showing', 'lock box code', 'price lock' on a new-construction contract (an agent matter). Only the rate-lock OFFER collocation trips this row.",
    suggest: "your loan officer handles rate locks \u2014 refer the recipient to them"
  },
  {
    token: "refinance with me",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "refinance with me",
      "refinance with us",
      "i can refinance you",
      "we can refinance you",
      "i can refinance your",
      "we can refinance your",
      "let me refinance",
      "let us refinance",
      "refinance your loan with me",
      "refinance your mortgage with me",
      "refinance your loan with us",
      "refinance your mortgage with us"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Soliciting a refinance as the originator ('refinance with me') is an MLO act. Forbidden for an agent. DELIBERATELY NOT CAUGHT: educational refi talk an agent may write \u2014 'refinancing can lower your payment', 'when rates drop, refinancing may make sense', 'ask your loan officer about a refinance'. Only the first-person ORIGINATOR solicitation ('refinance with me/us', 'I can refinance you') trips this row.",
    suggest: "talk to your loan officer about refinancing options"
  },
  {
    token: "apply for a loan with me",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "apply for a loan with me",
      "apply for a loan with us",
      "apply for a mortgage with me",
      "apply for a mortgage with us",
      "apply for your loan with me",
      "apply for your mortgage with me",
      "start your loan application with me",
      "start your loan application with us",
      "start your mortgage application with me",
      "complete your loan application with me",
      "i can take your loan application",
      "we can take your loan application"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Taking a loan/mortgage application is the defining MLO act under the SAFE Act. Forbidden for an agent. DELIBERATELY NOT CAUGHT: an agent steering the borrower TO the MLO \u2014 'apply for a loan with your loan officer', 'your lender can help you apply' (and the explicit referral-disclaimer-banner allowance). Only the first-person 'with me/us' origination collocation trips this row, so a bare educational 'you'll need to apply for a loan' is not flagged.",
    suggest: "your loan officer takes loan applications \u2014 refer the recipient to them"
  },
  {
    token: "recommend a loan product",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "i recommend an fha loan",
      "i recommend a va loan",
      "i recommend a usda loan",
      "i recommend a conventional loan",
      "i recommend a jumbo loan",
      "i recommend an arm",
      "i recommend a heloc",
      "i recommend a home equity loan",
      "i recommend a reverse mortgage",
      "you should get an fha loan",
      "you should get a va loan",
      "you should get a conventional loan",
      "you should get a heloc",
      "you should get an arm",
      "the right loan for you is",
      "the best loan for you is",
      "i'd recommend a fixed-rate mortgage",
      "i recommend a fixed-rate mortgage",
      "i recommend an adjustable-rate mortgage"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Recommending a SPECIFIC loan product/program to a consumer is loan advice reserved to an MLO. Forbidden for an agent. DELIBERATELY NOT CAUGHT: an agent NAMING loan types educationally without recommending one \u2014 'FHA, VA, and conventional loans are all options your loan officer can explain', 'ask your lender which program fits'. Only the first-person RECOMMENDATION collocation ('I recommend a \u2026', 'you should get a \u2026', 'the right loan for you is \u2026') trips this row.",
    suggest: "your loan officer advises on loan products \u2014 refer the recipient to them"
  },
  {
    token: "apr trigger term",
    lane: "AGENT_LANE_VIOLATION",
    matchType: "phrase",
    // Reg Z (12 CFR §1026.24) trigger terms: an APR figure or a specific monthly-
    // payment figure stated as a consumer-credit OFFER. The numeric token is
    // matched by a phrase 'apr' / 'a.p.r.' collocation. A bare APR figure in a
    // disclosure (or an agent quoting "the APR was disclosed at closing") is
    // out-of-scope; the framing words ('your'/'only'/'as low as'/'just') carry the
    // offer sense.
    // NOTE on matching: the shared phrase matcher requires the form's words to be
    // adjacent (separated only by non-word chars), so a form like "only … per
    // month" with a NUMBER between would NOT match (the digits are word chars).
    // We therefore key on adjacent-word offer collocations only ("your apr will
    // be", "rates as low as", "payment as low as"), and DOCUMENT that strict
    // numeric APR/payment detection is the consumer's own Reg-Z scan (see note).
    forms: [
      "your apr will be",
      "your apr is",
      "your a.p.r. will be",
      "your monthly payment will be",
      "your monthly payment is",
      "your estimated monthly payment will be",
      "your estimated payment will be",
      "rates as low as",
      "rate as low as",
      "apr as low as",
      "payments as low as",
      "payment as low as",
      "monthly payments as low as"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Reg Z (TILA, 12 CFR \xA71026.24) governs consumer-credit advertising 'trigger terms' \u2014 a stated APR or specific monthly payment as an OFFER pulls in mandatory disclosures only a lender/MLO can make. Forbidden for an agent. DELIBERATELY NOT CAUGHT: general payment math an agent may show generically \u2014 'a rough rule of thumb is principal-and-interest of about $X per $100k' framed as illustration, or APR named in a marked disclaimer block. Only the possessive ('your APR/payment will be') and 'as low as' OFFER framing trips this row. IMPORTANT LIMITATION: this row keys on offer-framing collocations, NOT on parsing a numeric percentage or dollar figure (the shared phrase matcher cannot span a number) \u2014 a downstream consumer that wants strict numeric APR/payment trigger-term detection MUST pair this with its own Reg-Z numeric scan.",
    suggest: "loan pricing/APR comes from the loan officer \u2014 omit or refer"
  },
  // ════════════════════════════════════════════════════════════════════════
  // MLO_LANE_VIOLATION — agent-only language an MLO must not use.
  // ════════════════════════════════════════════════════════════════════════
  {
    token: "list your home with me",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "list your home with me",
      "list your home with us",
      "list your house with me",
      "list your house with us",
      "list your property with me",
      "list your property with us",
      "list with me",
      "list with us",
      "i can list your home",
      "we can list your home",
      "i'll list your home",
      "let me list your home",
      "ready to list your home"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Soliciting a listing ('list your home with me') is brokerage activity requiring a real-estate license \u2014 forbidden for an MLO. DELIBERATELY NOT CAUGHT: ordinary 'list' uses an MLO may write \u2014 'a checklist for closing', 'the list of documents we need', 'your listing agent can help' (steering to the agent). Only the first-person listing SOLICITATION collocation trips this row.",
    suggest: "refer the recipient to their real-estate agent to list a home"
  },
  {
    token: "i'll sell your home",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "i'll sell your home",
      "i will sell your home",
      "i can sell your home",
      "we'll sell your home",
      "we will sell your home",
      "we can sell your home",
      "i'll sell your house",
      "i can sell your house",
      "let me sell your home",
      "let me sell your house",
      "sell your home for you",
      "sell your house for you",
      "i'll get your home sold",
      "i can get your home sold"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Offering to sell a consumer's home is brokerage activity \u2014 forbidden for an MLO. DELIBERATELY NOT CAUGHT: market-education an MLO may write \u2014 'homes are selling quickly in your area', 'when you sell your home, the proceeds can pay off your loan', 'your agent can help you sell'. Only the first-person OFFER-TO-SELL collocation ('I'll/I can sell your home', 'sell your home for you') trips this row.",
    suggest: "refer the recipient to their real-estate agent to sell a home"
  },
  {
    token: "i'm your real estate agent",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "i'm your real estate agent",
      "i am your real estate agent",
      "i'm your realtor",
      "i am your realtor",
      "as your real estate agent",
      "as your realtor",
      "as your listing agent",
      "as your buyer's agent",
      "i'm your listing agent",
      "i am your listing agent",
      "i'll be your real estate agent",
      "i will be your real estate agent",
      "i'm your agent",
      "i am your agent"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Claiming to be the consumer's real-estate agent / Realtor / listing agent is holding oneself out as licensed brokerage \u2014 forbidden for an MLO. DELIBERATELY NOT CAUGHT: an MLO naming the OTHER professional \u2014 'your real estate agent can help with that', 'work with your agent on the offer', 'I'm your loan officer, not your agent' (negation). Only the FIRST-PERSON identity claim ('I'm/I am/as your \u2026 agent/Realtor') trips this row. Edge: bare 'I'm your agent' is included because in an MLO-authored email it is a cross-lane identity claim; an MLO who means 'loan agent' should write 'loan officer'.",
    suggest: "identify yourself as the loan officer; name the agent as a separate professional"
  },
  {
    token: "let me show you homes",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "let me show you homes",
      "let me show you houses",
      "let me show you some homes",
      "let me show you properties",
      "i can show you homes",
      "i can show you houses",
      "we can show you homes",
      "i'll show you homes",
      "i'll show you houses",
      "schedule a showing with me",
      "schedule a showing with us",
      "book a showing with me",
      "i can schedule a showing",
      "let's tour some homes",
      "i can take you to see homes"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Offering to show homes / schedule showings is brokerage activity \u2014 forbidden for an MLO. DELIBERATELY NOT CAUGHT: education an MLO may write \u2014 'when you're ready to see homes, your agent can set up showings', 'open houses are a great way to see homes'. Only the first-person OFFER-TO-SHOW collocation ('let me/I can show you homes', 'schedule a showing with me') trips this row.",
    suggest: "refer the recipient to their real-estate agent for showings"
  },
  {
    token: "my listings",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    // The PLURAL "my listings" is unambiguously real-estate inventory. The bare
    // SINGULAR "my listing" is NOT a form here — it collides with the ordinary
    // sense "my listing of the documents" (a list of items). The property sense
    // of the singular is carried by explicit collocations ("my new listing", "my
    // listing agreement", "my just-listed home").
    forms: [
      "my listings",
      "my latest listings",
      "my new listings",
      "my featured listings",
      "my current listings",
      "check out my listings",
      "view my listings",
      "see my listings",
      "browse my listings",
      "my just-listed homes",
      "my just-listed home",
      "my new listing",
      "my latest listing",
      "my featured listing",
      "my listing agreement",
      "homes i have listed"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Advertising 'my listings' represents the sender as the listing broker \u2014 forbidden for an MLO. DELIBERATELY NOT CAUGHT: non-real-estate 'listing' uses \u2014 the bare singular 'my listing of required documents' (a list of items; the bare singular 'my listing' is intentionally NOT a form), 'the listings on the MLS' (no possessive), 'your agent's listings'. Only the FIRST-PERSON POSSESSIVE PLURAL 'my listings' and unambiguous property collocations ('my new listing', 'my listing agreement', 'my just-listed home') trip this row.",
    suggest: "do not advertise property listings; refer the recipient to their agent"
  },
  {
    token: "free cma to list",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    // A CMA (comparative market analysis) presented as a LISTING SOLICITATION.
    // A bare "comparative market analysis" mention is NOT caught — an MLO may
    // reference that a CMA exists; the solicitation framing is what crosses lanes.
    forms: [
      "free cma",
      "free comparative market analysis",
      "get your free cma",
      "request your free cma",
      "free home valuation to list",
      "what's your home worth list",
      "i'll prepare a cma to list",
      "i can prepare a cma",
      "let me prepare a cma",
      "i'll run a cma for you",
      "free market analysis to sell your home",
      "complimentary cma"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Offering a free CMA / home valuation as a listing-solicitation hook is a brokerage prospecting act \u2014 forbidden for an MLO. DELIBERATELY NOT CAUGHT: an MLO referencing a CMA neutrally \u2014 'your agent can prepare a comparative market analysis (CMA)', 'a CMA estimates market value'. Only the SOLICITATION framing ('free CMA', 'request your free CMA', 'I'll prepare a CMA to list') trips this row. NOTE: the bare phrase 'comparative market analysis' (educational) is intentionally NOT a form here \u2014 only the 'free'/'I'll prepare'/'to list' solicitation collocations are.",
    suggest: "refer the recipient to their agent for a CMA or home valuation"
  },
  {
    token: "represent you in the purchase or sale",
    lane: "MLO_LANE_VIOLATION",
    matchType: "phrase",
    forms: [
      "represent you in the purchase",
      "represent you in the sale",
      "represent you in the purchase or sale",
      "represent you in buying",
      "represent you in selling",
      "represent you as your agent",
      "i can represent you in the purchase",
      "i can represent you in the sale",
      "i'll represent you in the purchase",
      "i'll represent you in the sale",
      "let me represent you in the purchase",
      "let me represent you in the sale",
      "represent you in your home purchase",
      "represent you in your home sale"
    ],
    severity: "WARNING",
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Offering to 'represent' a consumer in a real-estate purchase or sale is agency/brokerage representation \u2014 forbidden for an MLO. DELIBERATELY NOT CAUGHT: an MLO describing loan-side representation/help \u2014 'represent your loan file to the underwriter' (not a real-estate-agency act), 'your agent represents you in the purchase' (naming the other professional). Only the first-person 'represent you in the purchase/sale/buying/selling' collocation trips this row.",
    suggest: "the real-estate agent represents the buyer/seller \u2014 refer the recipient to them"
  }
];
var LANE_TOKEN_SET = new Set(
  LANE_REGISTRY.map((e) => e.token)
);
function listLaneEntries(lane) {
  return lane ? LANE_REGISTRY.filter((e) => e.lane === lane) : LANE_REGISTRY;
}

// src/rate-claims/scan.ts
var RATE_CLAIM_CONFIG = {
  status: "DRAFT",
  defaultSeverity: "WARNING",
  armed: false,
  tokens: ["regz_rate_figure_no_apr", "udaap_rate_comparison"]
};
var DEFAULT_SEVERITY = "WARNING";
var SEVERITY_RANK = {
  REVIEW_FLAG: 0,
  WARNING: 1,
  HARD_BLOCK: 2
};
function applyFloor(rowSeverity, floor) {
  if (!floor) return rowSeverity;
  return SEVERITY_RANK[floor] > SEVERITY_RANK[rowSeverity] ? floor : rowSeverity;
}
function withinAnyRange2(offset, ranges) {
  if (!ranges) return false;
  return ranges.some(([start, end]) => offset >= start && offset < end);
}
var PERCENT_TOKEN = /\b\d{1,2}(?:\.\d+)?\s*(?:%|percent\b)/gi;
var WINDOW = 40;
var APR_PRESENT = /\bapr\b|\ba\.p\.r\.|\bannual percentage rate\b/i;
var OWN_RATE_CUES = /\byour\s+(?:current\s+|existing\s+|locked(?:[\s-]?in)?\s+)?rate\b|\btheir\s+(?:current\s+|existing\s+)?rate\b|\brate\s+alert\b|\byou(?:'re|\s+are)\s+sitting\s+on\b|\byour\s+\d{1,2}(?:\.\d+)?\s*(?:%|percent)\s+rate\b|\bthe\s+rate\s+you(?:'?ve|'?re|\s+(?:have|had|locked|got|are))\b/i;
var OFFER_CUES = /\bnew\s+rate\b|\bcould\s+(?:be|get|drop|go|lock|save|qualify)\b|\byou\s+could\b|\bwe\s+could\b|\brefi(?:nance)?\b|\bget\s+you\b|\bqualify\s+for\b|\bdown\s+to\b|\bas\s+low\s+as\b|\block\s+you\s+in\b|\bwe\s+can\s+(?:get|offer|lock)\b|\bwill\s+be\b|\bwould\s+be\b/i;
var OWN_RATE_WINDOW = WINDOW;
var CLAUSE_BOUNDARY_RE = /[.!?;:,\n]/;
var RATE_NOUN_RE = /^(?:rates?|apr|fixed|\d{1,2}-?year)$/i;
var RATE_BRIDGE_RE = /^(?:of|at|near|around|about|to|from|under|below|above|over|by|in|on|is|are|was|were|be|been|hit|hits|reached?|sits?|sitting|sat|hovers?|hovering|hovered|remains?|stays?|holds?|holding|held|averages?|averaged|averaging|drops?|dropped|fell|falls?|rose|rises?|climbed|climbs?|moved?|moves|starts?|starting)$/i;
var WORD_RE = /[a-z0-9][a-z0-9'.-]*/gi;
var RATE_PHRASE_MAX_WORDS = 4;
var RATE_CONNECTIVE_RE = /^(?:has|have|had|being|will|would|could|can|may|might|should|currently|now|today|still|just|right|roughly|approximately|nearly|almost|sitting|running|trending|down|again|lately|recently|already|only)$/i;
function isConnective(word) {
  return RATE_BRIDGE_RE.test(word) || RATE_CONNECTIVE_RE.test(word);
}
var RATE_MOVEMENT_RE = /^(?:ris(?:e|es|en|ing)|rose|fall(?:s|en|ing)?|fell|drop(?:s|ped|ping)?|down|up|lift(?:s|ed|ing)?|cut(?:s|ting)?|climb(?:s|ed|ing)?|slip(?:s|ped|ping)?|eas(?:e|es|ed|ing))$/i;
var RATE_LEVEL_RE = /^(?:to|at|from|is|are|was|were|be|been|sits?|sat|sitting|near|around|hovers?|hovered|hovering|holds?|holding|held|stays?|stayed|remains?|remained|averages?|averaged|averaging)$/i;
var NUMBER_RE = /^\d{1,2}(?:\.\d+)?$/;
function isMovementBridge(bridge) {
  let last = -1;
  for (let i = bridge.length - 1; i >= 0; i--) {
    if (RATE_MOVEMENT_RE.test(bridge[i])) {
      last = i;
      break;
    }
  }
  if (last < 0) return false;
  return !bridge.slice(last + 1).some((w) => RATE_LEVEL_RE.test(w));
}
function words(text) {
  return (text.match(WORD_RE) ?? []).map((w) => w.replace(/\.$/, ""));
}
function rateNounGoverns(before, after) {
  const pre = words(before);
  const post = words(after);
  for (let i = pre.length - 1, bridged = 0; i >= 0 && bridged <= RATE_PHRASE_MAX_WORDS; i--) {
    if (RATE_NOUN_RE.test(pre[i])) {
      if (isMovementBridge(pre.slice(i + 1))) break;
      return true;
    }
    const numberBeforeTo = NUMBER_RE.test(pre[i]) && pre[i + 1]?.toLowerCase() === "to";
    if (!isConnective(pre[i]) && !numberBeforeTo) break;
    bridged++;
  }
  const n1 = post[0];
  const n2 = post[1];
  if (n1 && RATE_NOUN_RE.test(n1)) return true;
  if (n1 && n2 && RATE_BRIDGE_RE.test(n1) && RATE_NOUN_RE.test(n2)) return true;
  return false;
}
function isClauseBoundaryAt(text, i) {
  if (!CLAUSE_BOUNDARY_RE.test(text[i])) return false;
  if ((text[i] === "." || text[i] === ",") && /\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) return false;
  return true;
}
function clauseAround(text, from, to) {
  let start = 0;
  for (let i = from - 1; i >= 0; i--) {
    if (isClauseBoundaryAt(text, i)) {
      start = i + 1;
      break;
    }
  }
  let end = text.length;
  for (let i = to; i < text.length; i++) {
    if (isClauseBoundaryAt(text, i)) {
      end = i;
      break;
    }
  }
  return { before: text.slice(start, from), after: text.slice(to, end) };
}
function isRateFigure(masked, idx, len, digits) {
  if (/\.\d{3,}$/.test(digits)) return true;
  const { before, after } = clauseAround(masked, idx, idx + len);
  return rateNounGoverns(before, after);
}
function classifyPercentFigures(text) {
  if (typeof text !== "string" || text.length === 0) return [];
  const lower = maskHtml(text).toLowerCase();
  const out = [];
  PERCENT_TOKEN.lastIndex = 0;
  let m;
  while ((m = PERCENT_TOKEN.exec(lower)) !== null) {
    const idx = m.index;
    if (PERCENT_TOKEN.lastIndex === idx) PERCENT_TOKEN.lastIndex++;
    const digits = m[0].replace(/\s*(?:%|percent)$/i, "");
    out.push({ index: idx, matchedText: text.slice(idx, idx + m[0].length), isRateFigure: isRateFigure(lower, idx, m[0].length, digits) });
  }
  return out;
}
function scanRegZ(text, masked) {
  const lower = masked.toLowerCase();
  const out = [];
  PERCENT_TOKEN.lastIndex = 0;
  let m;
  while ((m = PERCENT_TOKEN.exec(lower)) !== null) {
    const idx = m.index;
    if (PERCENT_TOKEN.lastIndex === idx) PERCENT_TOKEN.lastIndex++;
    const digits = m[0].replace(/\s*(?:%|percent)$/i, "");
    if (!isRateFigure(lower, idx, m[0].length, digits)) continue;
    const start = Math.max(0, idx - WINDOW);
    const end = Math.min(lower.length, idx + m[0].length + WINDOW);
    const ctx = lower.slice(start, end);
    if (APR_PRESENT.test(ctx)) continue;
    if (OWN_RATE_CUES.test(ctx) && !OFFER_CUES.test(ctx)) continue;
    out.push({ index: idx, matchedText: text.slice(idx, idx + m[0].length) });
  }
  return out;
}
var UDAAP_PATTERNS = [
  // "below market" family (the live-violation pattern: "running below the
  // broader market average"). Optional "the"/"broader"/"national"/"going".
  {
    re: /\bbelow\s+(?:the\s+)?(?:broader\s+|national\s+|going\s+)?market(?:\s+(?:average|rate))?\b/i,
    label: "below-market rate comparison"
  },
  { re: /\bbelow\s+(?:the\s+)?national\s+average\b/i, label: "below-national-average rate comparison" },
  { re: /\bbelow\s+average\s+(?:rate|rates|on\s+(?:your|the)\s+(?:rate|loan|mortgage))?\b/i, label: "below-average rate comparison" },
  // "lower / better than other lenders/banks/competition"
  { re: /\b(?:lower|better)\s+than\s+(?:the\s+|other\s+|your\s+(?:current\s+)?)?(?:lenders?|banks?|competition|competitors?|rate)\b/i, label: "lower-than-competitors rate comparison" },
  // "beat any/your rate", "beat the bank", "we'll beat", "nobody can beat", "can't be beat"
  { re: /\bbeat\s+(?:any|your|the|their|our\s+competitors?'?)\s+(?:rate|rates|price|bank|lender|offer)\b/i, label: "beat-any-rate claim" },
  { re: /\b(?:we'?ll|we\s+will|i'?ll|i\s+will)\s+beat\b/i, label: "we'll-beat claim" },
  { re: /\b(?:nobody|no\s+one)\s+can\s+beat\b/i, label: "nobody-can-beat claim" },
  { re: /\bcan'?t\s+be\s+beat(?:en)?\b/i, label: "can't-be-beat claim" },
  { re: /\bunbeatable\s+rates?\b/i, label: "unbeatable-rate claim" },
  // "lowest / best / most competitive rate"
  { re: /\b(?:the\s+)?lowest\s+rates?\b/i, label: "lowest-rate superlative claim" },
  { re: /\b(?:the\s+)?best\s+rates?\b/i, label: "best-rate superlative claim" },
  { re: /\bmost\s+competitive\s+rates?\b/i, label: "most-competitive-rate claim" },
  { re: /\brates?\s+(?:that\s+)?(?:nobody|no\s+one)\s+can\s+match\b/i, label: "no-one-can-match-rate claim" },
  // Basis-point / point comparison (the one numeric UDAAP form).
  { re: /\b\d+(?:\.\d+)?\s*(?:bps|basis\s+points?|points?)\s+(?:below|under|lower\s+than|cheaper\s+than)\b/i, label: "basis-points-below rate comparison" }
];
function scanUdaap(text, masked) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const { re } of UDAAP_PATTERNS) {
    const r = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    r.lastIndex = 0;
    let m;
    while ((m = r.exec(masked)) !== null) {
      if (r.lastIndex === m.index) r.lastIndex++;
      if (seen.has(m.index)) continue;
      seen.add(m.index);
      out.push({ index: m.index, matchedText: text.slice(m.index, m.index + m[0].length) });
    }
  }
  return out;
}
var REGZ_SUGGEST = "omit the rate figure (or pair it with APR) and use directional language ('rates have eased') \u2014 rate quotes come from the loan officer";
var UDAAP_SUGGEST = "remove the rate self-comparison; cite only factual, data-sourced market/value stats";
function buildMessage2(token, matchedText, index, severity, suggest) {
  const label = token === "regz_rate_figure_no_apr" ? "a stated mortgage-rate figure without a nearby APR (Reg Z / TILA \xA71026.24)" : "an unsubstantiated rate self-comparison (CFPB UDAAP)";
  return `\u26A0 ${severity} [rate-claim]: "${matchedText}" is ${label} ("${token}") at offset ${index} \u2192 ${suggest}`;
}
function scanRateClaims(text, opts = {}) {
  if (typeof text !== "string" || text.length === 0) return [];
  const masked = maskHtml(text);
  const violations = [];
  const push = (token, index, matchedText, suggest) => {
    if (withinAnyRange2(index, opts.disclaimerRanges)) return;
    const severity = applyFloor(DEFAULT_SEVERITY, opts.severityFloor);
    violations.push({
      token,
      severity,
      index,
      matchedText,
      suggest,
      message: buildMessage2(token, matchedText, index, severity, suggest)
    });
  };
  for (const { index, matchedText } of scanRegZ(text, masked)) {
    push("regz_rate_figure_no_apr", index, matchedText, REGZ_SUGGEST);
  }
  for (const { index, matchedText } of scanUdaap(text, masked)) {
    push("udaap_rate_comparison", index, matchedText, UDAAP_SUGGEST);
  }
  violations.sort((a, b) => a.index - b.index || a.token.localeCompare(b.token));
  return violations;
}
function hasRateClaimViolation(text, opts = {}) {
  return scanRateClaims(text, opts).length > 0;
}

// src/lanes/scan.ts
var COMPILED2 = LANE_REGISTRY.map((entry) => ({
  entry,
  matcher: compileMatcher(entry),
  hasOwnRate: entry.allowedContexts.some((c) => c.kind === "own-rate")
}));
function isOwnRate(masked, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - OWN_RATE_WINDOW);
  const end = Math.min(masked.length, matchIndex + matchLength + OWN_RATE_WINDOW);
  const ctx = masked.slice(start, end);
  return OWN_RATE_CUES.test(ctx) && !OFFER_CUES.test(ctx);
}
var SEVERITY_RANK2 = {
  REVIEW_FLAG: 0,
  WARNING: 1,
  HARD_BLOCK: 2
};
function applyFloor2(rowSeverity, floor) {
  if (!floor) return rowSeverity;
  return SEVERITY_RANK2[floor] > SEVERITY_RANK2[rowSeverity] ? floor : rowSeverity;
}
function lanesForRole(role) {
  switch (role) {
    case "AGENT":
      return ["AGENT_LANE_VIOLATION"];
    case "MLO":
      return ["MLO_LANE_VIOLATION"];
    case "DUAL":
      return [];
    default:
      return ["AGENT_LANE_VIOLATION", "MLO_LANE_VIOLATION"];
  }
}
function buildMessage3(entry, matchedText, index, severity) {
  const laneLabel = entry.lane === "AGENT_LANE_VIOLATION" ? "MLO-only language in an agent's copy" : "agent-only language in an MLO's copy";
  const base = `\u26A0 ${severity} [lane]: "${matchedText}" is ${laneLabel} ("${entry.token}") at offset ${index}`;
  return entry.suggest ? `${base} \u2192 ${entry.suggest}` : base;
}
function scanLaneViolations(text, role, opts = {}) {
  if (typeof text !== "string" || text.length === 0) return [];
  const applicable = new Set(lanesForRole(role));
  if (applicable.size === 0) return [];
  const masked = maskHtml(text);
  const words2 = indexWords(masked);
  const violations = [];
  for (const { entry, matcher, hasOwnRate } of COMPILED2) {
    if (!applicable.has(entry.lane)) continue;
    for (const { index, matchedText } of runMatcher(matcher, text, masked, words2, opts.disclaimerRanges)) {
      if (hasOwnRate && isOwnRate(masked, index, matchedText.length)) continue;
      const severity = applyFloor2(entry.severity, opts.severityFloor);
      violations.push({
        token: entry.token,
        lane: entry.lane,
        severity,
        index,
        matchedText,
        suggest: entry.suggest,
        message: buildMessage3(entry, matchedText, index, severity)
      });
    }
  }
  violations.sort((a, b) => a.index - b.index || a.token.localeCompare(b.token));
  return violations;
}
function hasLaneViolation(text, role, opts = {}) {
  return scanLaneViolations(text, role, opts).length > 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CLAUSE_BREAKERS,
  COMPLIANCE_REGISTRY,
  COMPLIANCE_TOKEN_SET,
  DEFAULT_LIST_NEGATION_PROXIMITY,
  DEFAULT_NEGATION_PROXIMITY,
  LANE_REGISTRY,
  LANE_TOKEN_SET,
  LIST_COORDINATORS,
  NEGATION_CUES,
  RATE_CLAIM_CONFIG,
  checkCompliance,
  classifyPercentFigures,
  hasHardBlock,
  hasLaneViolation,
  hasRateClaimViolation,
  listComplianceEntries,
  listLaneEntries,
  scanLaneViolations,
  scanRateClaims
});
//# sourceMappingURL=index.cjs.map