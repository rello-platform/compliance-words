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
      // Ruling 2 (v0.1.2, Kelly 2026-06-01): compliance-REQUIRED disclaimer
      // collocations that name the INSTITUTIONAL approval GATE are PROTECTIVE
      // language, not an advertising claim. "subject to underwriting approval",
      // "subject to credit approval", "lender approval required", "approval is not
      // guaranteed" warn the borrower that approval is conditional — the opposite
      // of an inducement. Registered NARROWLY as institutional-gate nouns so the
      // genuine promotional claim STILL HARD_BLOCKs: "loan approval" ("Get loan
      // approval today"), bare "approved" ("you're approved!") and "guarantee
      // approval" carry no institutional-gate compound and remain blocked. Clears
      // live Report-Engine disclaimer copy (pfp_prequal_summary "…underwriting
      // approval are required"; nonqm_scenarios_compare "subject to underwriting
      // approval"). Closes Kelly-HALTED judgment #2.
      {
        kind: "compound",
        pattern: "underwriting approval",
        note: "Ruling 2 (Kelly 2026-06-01): the institutional underwriting gate ('subject to underwriting approval', '\u2026underwriting approval are required') is a required protective disclaimer, not an advertising claim. Narrow institutional-gate noun \u2014 'loan approval'/'approved'/'guarantee approval' still HARD_BLOCK."
      },
      {
        kind: "compound",
        pattern: "credit approval",
        note: "Ruling 2 (Kelly 2026-06-01): 'subject to credit approval' is a required protective disclaimer naming the institutional credit gate, not an advertising claim."
      },
      {
        kind: "compound",
        pattern: "lender approval",
        note: "Ruling 2 (Kelly 2026-06-01): 'lender approval required' / 'subject to lender approval' is a required protective disclaimer naming the institutional lender gate, not an advertising claim."
      },
      {
        kind: "compound",
        pattern: "approval is not guaranteed",
        note: "Ruling 2 (Kelly 2026-06-01): 'approval is not guaranteed' is a protective disclaimer \u2014 the 'not'/'guaranteed' sit AFTER 'approval' so the generic negation rule cannot reach it; the fixed disclaimer phrase is registered explicitly."
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
    // posture of approval/quote (P3 finding).
    //
    // Ruling 1 (v0.1.2, Kelly 2026-06-01): "pre-qualified" as a PRODUCT NAME is
    // identity, not an advertising claim. The split is grammatical and reliable:
    // the -ION NOUN "pre-qualification" / "prequalification" NAMES the product /
    // feature / document (the PathfinderPro "Pre-Qualification Summary", its
    // section/status labels, "this pre-qualification is based on…", "ask for an
    // official pre-qualification") — it is never the prohibited inducement. The
    // prohibited advertising claim is always the -ED ADJECTIVE/VERB applied to the
    // borrower ("you're pre-qualified!", "you are pre-qualified, lock your rate",
    // "get pre-qualified now") — those forms ("pre-qualified", "pre-qualify",
    // "pre-qualifies", "pre-qualifying", "prequalified", …) carry NO identity
    // compound and remain HARD_BLOCK. So the noun is registered as a product-name
    // identity compound (NOT removed from the token — per the ruling's mechanism)
    // while every adjective/verb form still blocks. Closes Kelly-HALTED judgment
    // #1. Residual (documented, surfaced to DKA): the 3rd-person status sentence
    // "<borrower> is pre-qualified" uses the -ED adjective and stays in scope —
    // deliberately, so the 2nd-person claim "you're pre-qualified" cannot slip;
    // the summary could title-case it to a "Pre-Qualified" badge if Kelly wants it
    // cleared too.
    allowedContexts: [
      {
        kind: "compound",
        pattern: "pre-qualification",
        note: "Ruling 1 (Kelly 2026-06-01): the -ION NOUN naming the product/feature/document ('Pre-Qualification Summary' title, the status labels, 'this pre-qualification is based on\u2026', 'an official pre-qualification') is identity, not an advertising claim. The -ED adjective claim form ('you're pre-qualified') carries no compound and still HARD_BLOCKs."
      },
      {
        kind: "compound",
        pattern: "prequalification",
        note: "Ruling 1 (Kelly 2026-06-01): the unhyphenated spelling of the product-name noun \u2014 same identity allowance as 'pre-qualification'."
      },
      NEGATION,
      DISCLAIMER
    ],
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
function runMatcher(compiled, text, masked, words, disclaimerRanges) {
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
    if (compiled.hasNegation && isNegated(masked, words, index, compiled.negationProximity, compiled.listNegationProximity)) {
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
  const words = indexWords(masked);
  const violations = [];
  for (const { entry, matcher } of COMPILED) {
    for (const { index, matchedText } of runMatcher(matcher, text, masked, words, opts.disclaimerRanges)) {
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
    allowedContexts: [NEGATION2, DISCLAIMER2],
    rationale: "Quoting a SPECIFIC interest rate as a personal offer is loan origination \u2014 an MLO act under the SAFE Act. Forbidden for an agent. DELIBERATELY NOT CAUGHT (false-positive guards): general market context an agent may freely cite \u2014 'today's 30-year rates are around 6% per Freddie Mac', 'rates have come down', 'when rates drop you may want to refinance', 'ask your loan officer about current rates'. Only the possessive/first-person OFFER framing ('your rate is\u2026', 'we can offer you a rate of\u2026') trips this row.",
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

// src/lanes/scan.ts
var COMPILED2 = LANE_REGISTRY.map((entry) => ({
  entry,
  matcher: compileMatcher(entry)
}));
var SEVERITY_RANK = {
  REVIEW_FLAG: 0,
  WARNING: 1,
  HARD_BLOCK: 2
};
function applyFloor(rowSeverity, floor) {
  if (!floor) return rowSeverity;
  return SEVERITY_RANK[floor] > SEVERITY_RANK[rowSeverity] ? floor : rowSeverity;
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
function buildMessage2(entry, matchedText, index, severity) {
  const laneLabel = entry.lane === "AGENT_LANE_VIOLATION" ? "MLO-only language in an agent's copy" : "agent-only language in an MLO's copy";
  const base = `\u26A0 ${severity} [lane]: "${matchedText}" is ${laneLabel} ("${entry.token}") at offset ${index}`;
  return entry.suggest ? `${base} \u2192 ${entry.suggest}` : base;
}
function scanLaneViolations(text, role, opts = {}) {
  if (typeof text !== "string" || text.length === 0) return [];
  const applicable = new Set(lanesForRole(role));
  if (applicable.size === 0) return [];
  const masked = maskHtml(text);
  const words = indexWords(masked);
  const violations = [];
  for (const { entry, matcher } of COMPILED2) {
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
        message: buildMessage2(entry, matchedText, index, severity)
      });
    }
  }
  violations.sort((a, b) => a.index - b.index || a.token.localeCompare(b.token));
  return violations;
}
function hasLaneViolation(text, role, opts = {}) {
  return scanLaneViolations(text, role, opts).length > 0;
}

// src/rate-claims/scan.ts
var RATE_CLAIM_CONFIG = {
  status: "DRAFT",
  defaultSeverity: "WARNING",
  armed: false,
  tokens: ["regz_rate_figure_no_apr", "udaap_rate_comparison"]
};
var DEFAULT_SEVERITY = "WARNING";
var SEVERITY_RANK2 = {
  REVIEW_FLAG: 0,
  WARNING: 1,
  HARD_BLOCK: 2
};
function applyFloor2(rowSeverity, floor) {
  if (!floor) return rowSeverity;
  return SEVERITY_RANK2[floor] > SEVERITY_RANK2[rowSeverity] ? floor : rowSeverity;
}
function withinAnyRange2(offset, ranges) {
  if (!ranges) return false;
  return ranges.some(([start, end]) => offset >= start && offset < end);
}
var PERCENT_TOKEN = /\b\d{1,2}(?:\.\d{1,3})?\s*(?:%|percent\b)/gi;
var WINDOW = 40;
var RATE_CUES = /\brate\b|\brates\b|\bmortgage\b|\bapr\b|\bloan\b|\b30[\s-]?(?:year|yr)\b|\b15[\s-]?(?:year|yr)\b|thirty[\s-]?year|fifteen[\s-]?year|\bfixed\b|\barm\b|\bapy\b|\binterest\b|\bpoints?\b|\bbps\b|basis points?|offering|offered|locked? in|lock(?:ed)? at/i;
var VALUE_CUES = /\bup\b|from last year|year[\s-]?over[\s-]?year|\byoy\b|\bprices?\b|home values?|\bvalues?\b|\bworth\b|appreciat|\bgained\b|\bgaining\b|\brose\b|\brisen\b|\brising\b|climbed|\bequity\b|\bappreciation\b/i;
var APR_PRESENT = /\bapr\b|\ba\.p\.r\.|\bannual percentage rate\b/i;
function scanRegZ(text, masked) {
  const lower = masked.toLowerCase();
  const out = [];
  PERCENT_TOKEN.lastIndex = 0;
  let m;
  while ((m = PERCENT_TOKEN.exec(lower)) !== null) {
    const idx = m.index;
    if (PERCENT_TOKEN.lastIndex === idx) PERCENT_TOKEN.lastIndex++;
    const start = Math.max(0, idx - WINDOW);
    const end = Math.min(lower.length, idx + m[0].length + WINDOW);
    const ctx = lower.slice(start, end);
    const hasRateCue = RATE_CUES.test(ctx);
    const hasValueCue = VALUE_CUES.test(ctx);
    if (hasValueCue && !hasRateCue) continue;
    if (APR_PRESENT.test(ctx)) continue;
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
function buildMessage3(token, matchedText, index, severity, suggest) {
  const label = token === "regz_rate_figure_no_apr" ? "a stated mortgage-rate figure without a nearby APR (Reg Z / TILA \xA71026.24)" : "an unsubstantiated rate self-comparison (CFPB UDAAP)";
  return `\u26A0 ${severity} [rate-claim]: "${matchedText}" is ${label} ("${token}") at offset ${index} \u2192 ${suggest}`;
}
function scanRateClaims(text, opts = {}) {
  if (typeof text !== "string" || text.length === 0) return [];
  const masked = maskHtml(text);
  const violations = [];
  const push = (token, index, matchedText, suggest) => {
    if (withinAnyRange2(index, opts.disclaimerRanges)) return;
    const severity = applyFloor2(DEFAULT_SEVERITY, opts.severityFloor);
    violations.push({
      token,
      severity,
      index,
      matchedText,
      suggest,
      message: buildMessage3(token, matchedText, index, severity, suggest)
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
export {
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
  hasHardBlock,
  hasLaneViolation,
  hasRateClaimViolation,
  listComplianceEntries,
  listLaneEntries,
  scanLaneViolations,
  scanRateClaims
};
//# sourceMappingURL=index.js.map