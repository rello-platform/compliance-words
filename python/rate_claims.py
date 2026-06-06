"""
Reference Python re-implementation of the numeric/comparison-aware Reg-Z + UDAAP
rate-claim checker — the Python half of the cross-language
@rello-platform/compliance-words source-of-truth for the two rate-claim rules
(DRAFT, warn-only).

Faithful port of the TypeScript `scanRateClaims`
(@rello-platform/compliance-words `src/rate-claims/scan.ts`). These two rules are
numeric/comparison-aware (a % rate figure; an "N bps below" comparison) and
CANNOT ride the shared phrase matcher (it can't span a number), so they are a
standalone scanner — NOT lane rows. v0.4.0 adds a LEAD-OWNED-RATE escape (Kelly
ruling 2026-06-03): a % about the lead's OWN existing rate is allowed; a
prospective OFFER ("your new rate could be 5.5%") still flags. The Reg-Z
rate-vs-value distinction is mirrored verbatim from Milo's `detectsRateFigure`
(composition-prompt-eval.test.ts) so the platform has ONE distinction.

DRAFT posture: every finding is WARNING; this scanner never blocks on its own.
The parity corpus in `rate_claims_parity_corpus.json` (run via
`test_rate_claims_parity.py`) re-asserts the TS↔Python verdict-for-verdict.

Pure functions over text — no I/O at call time, no throw on bad input.
"""

import re

# ── HTML masking (preserves offsets 1:1, mirror match-engine.ts maskHtml) ─────
_HTML_TAG_RE = re.compile(r"<[^>]*>")


def _mask_html(text):
    return _HTML_TAG_RE.sub(lambda m: " " * len(m.group(0)), text)


# ── Severity (mirror RateClaimSeverity + applyFloor) ──────────────────────────
_SEVERITY_RANK = {"REVIEW_FLAG": 0, "WARNING": 1, "HARD_BLOCK": 2}
_DEFAULT_SEVERITY = "WARNING"


def _apply_floor(row_severity, floor):
    if not floor:
        return row_severity
    return floor if _SEVERITY_RANK[floor] > _SEVERITY_RANK[row_severity] else row_severity


def _within_any_range(offset, ranges):
    if not ranges:
        return False
    return any(start <= offset < end for (start, end) in ranges)


# ── REG-Z numeric primitives (mirror detectsRateFigure + APR escape) ──────────
_PERCENT_TOKEN = re.compile(r"\b\d{1,2}(?:\.\d{1,3})?\s*(?:%|percent\b)", re.IGNORECASE)
_WINDOW = 40

_RATE_CUES = re.compile(
    r"\brate\b|\brates\b|\bmortgage\b|\bapr\b|\bloan\b|\b30[\s-]?(?:year|yr)\b|"
    r"\b15[\s-]?(?:year|yr)\b|thirty[\s-]?year|fifteen[\s-]?year|\bfixed\b|\barm\b|"
    r"\bapy\b|\binterest\b|\bpoints?\b|\bbps\b|basis points?|offering|offered|"
    r"locked? in|lock(?:ed)? at",
    re.IGNORECASE,
)
_VALUE_CUES = re.compile(
    r"\bup\b|from last year|year[\s-]?over[\s-]?year|\byoy\b|\bprices?\b|"
    r"home values?|\bvalues?\b|\bworth\b|appreciat|\bgained\b|\bgaining\b|"
    r"\brose\b|\brisen\b|\brising\b|climbed|\bequity\b|\bappreciation\b",
    re.IGNORECASE,
)
_APR_PRESENT = re.compile(r"\bapr\b|\ba\.p\.r\.|\bannual percentage rate\b", re.IGNORECASE)

# LEAD-OWNED-RATE escape (Kelly ruling 2026-06-03). A factual statement about the
# lead's OWN existing rate ("your current rate is 2.88%", "you're sitting on a
# 2.94% rate", "your 6.5% rate alert") is NOT an advertised offer → outside the
# Reg-Z trigger-term scope. Mirrors VALUE_CUES; an OFFER cue near the % overrides
# it (a prospective "your new rate could be 5.5%" / "your rate will be 5.5%" STILL
# flags). Mirror of scan.ts OWN_RATE_CUES / OFFER_CUES verbatim.
#
# SHARED SOURCE OF TRUTH (v0.5.0): exposed as module-level PUBLIC names so the
# Python LANE checker (python/lane_checker.py) imports these EXACT regexes for its
# AGENT `rate offer` own-rate escape — the two Python scanners must never carry two
# divergent own-rate definitions, matching the TS single-source discipline
# (src/lanes/scan.ts imports OWN_RATE_CUES/OFFER_CUES from src/rate-claims/scan.ts).
OWN_RATE_CUES = re.compile(
    r"\byour\s+(?:current\s+|existing\s+|locked(?:[\s-]?in)?\s+)?rate\b|"
    r"\btheir\s+(?:current\s+|existing\s+)?rate\b|\brate\s+alert\b|"
    r"\byou(?:'re|\s+are)\s+sitting\s+on\b|"
    r"\byour\s+\d{1,2}(?:\.\d{1,3})?\s*(?:%|percent)\s+rate\b|"
    r"\bthe\s+rate\s+you(?:'?ve|'?re|\s+(?:have|had|locked|got|are))\b",
    re.IGNORECASE,
)
# v0.5.0: added \bwill\s+be\b|\bwould\s+be\b — a FUTURE-TENSE quote is a
# prospective offer, not the lead's existing rate, so "your rate will be 5.5%" /
# "your rate would be 5.5%" stay flagged in BOTH scanners (present-tense "your
# rate is 2.88%" stays allowed). Mirror of scan.ts OFFER_CUES verbatim.
OFFER_CUES = re.compile(
    r"\bnew\s+rate\b|\bcould\s+(?:be|get|drop|go|lock|save|qualify)\b|"
    r"\byou\s+could\b|\bwe\s+could\b|\brefi(?:nance)?\b|\bget\s+you\b|"
    r"\bqualify\s+for\b|\bdown\s+to\b|\bas\s+low\s+as\b|\block\s+you\s+in\b|"
    r"\bwe\s+can\s+(?:get|offer|lock)\b|\bwill\s+be\b|\bwould\s+be\b",
    re.IGNORECASE,
)
# Window (chars) scanned on each side of a match for own-rate/offer cues — shared
# with the LANE checker so both Python scanners use the identical proximity.
OWN_RATE_WINDOW = _WINDOW

# Back-compat private aliases (existing call sites in _scan_regz use these).
_OWN_RATE_CUES = OWN_RATE_CUES
_OFFER_CUES = OFFER_CUES


def _scan_regz(text, masked):
    lower = masked.lower()
    out = []
    for m in _PERCENT_TOKEN.finditer(lower):
        idx = m.start()
        start = max(0, idx - _WINDOW)
        end = min(len(lower), idx + len(m.group(0)) + _WINDOW)
        ctx = lower[start:end]

        has_rate_cue = bool(_RATE_CUES.search(ctx))
        has_value_cue = bool(_VALUE_CUES.search(ctx))

        # Allow a clean home-VALUE figure: value cue present AND no rate cue.
        if has_value_cue and not has_rate_cue:
            continue
        # Allow a properly Reg-Z-disclosed rate: an APR token near the %.
        if _APR_PRESENT.search(ctx):
            continue
        # Allow the LEAD'S OWN existing rate (Kelly ruling): own-rate cue near the
        # % AND no prospective-OFFER framing → outside Reg-Z trigger-term scope.
        if _OWN_RATE_CUES.search(ctx) and not _OFFER_CUES.search(ctx):
            continue
        out.append((idx, text[idx:idx + len(m.group(0))]))
    return out


# ── UDAAP rate-comparison primitives (mirror UDAAP_PATTERNS) ──────────────────
_UDAAP_PATTERNS = [
    re.compile(r"\bbelow\s+(?:the\s+)?(?:broader\s+|national\s+|going\s+)?market(?:\s+(?:average|rate))?\b", re.IGNORECASE),
    re.compile(r"\bbelow\s+(?:the\s+)?national\s+average\b", re.IGNORECASE),
    re.compile(r"\bbelow\s+average\s+(?:rate|rates|on\s+(?:your|the)\s+(?:rate|loan|mortgage))?\b", re.IGNORECASE),
    re.compile(r"\b(?:lower|better)\s+than\s+(?:the\s+|other\s+|your\s+(?:current\s+)?)?(?:lenders?|banks?|competition|competitors?|rate)\b", re.IGNORECASE),
    re.compile(r"\bbeat\s+(?:any|your|the|their|our\s+competitors?'?)\s+(?:rate|rates|price|bank|lender|offer)\b", re.IGNORECASE),
    re.compile(r"\b(?:we'?ll|we\s+will|i'?ll|i\s+will)\s+beat\b", re.IGNORECASE),
    re.compile(r"\b(?:nobody|no\s+one)\s+can\s+beat\b", re.IGNORECASE),
    re.compile(r"\bcan'?t\s+be\s+beat(?:en)?\b", re.IGNORECASE),
    re.compile(r"\bunbeatable\s+rates?\b", re.IGNORECASE),
    re.compile(r"\b(?:the\s+)?lowest\s+rates?\b", re.IGNORECASE),
    re.compile(r"\b(?:the\s+)?best\s+rates?\b", re.IGNORECASE),
    re.compile(r"\bmost\s+competitive\s+rates?\b", re.IGNORECASE),
    re.compile(r"\brates?\s+(?:that\s+)?(?:nobody|no\s+one)\s+can\s+match\b", re.IGNORECASE),
    re.compile(r"\b\d+(?:\.\d+)?\s*(?:bps|basis\s+points?|points?)\s+(?:below|under|lower\s+than|cheaper\s+than)\b", re.IGNORECASE),
]


def _scan_udaap(text, masked):
    out = []
    seen = set()
    for r in _UDAAP_PATTERNS:
        for m in r.finditer(masked):
            if m.start() in seen:
                continue
            seen.add(m.start())
            out.append((m.start(), text[m.start():m.start() + len(m.group(0))]))
    return out


_REGZ_SUGGEST = (
    "omit the rate figure (or pair it with APR) and use directional language "
    "('rates have eased') — rate quotes come from the loan officer"
)
_UDAAP_SUGGEST = (
    "remove the rate self-comparison; cite only factual, data-sourced "
    "market/value stats"
)


def _build_message(token, matched_text, index, severity, suggest):
    label = (
        "a stated mortgage-rate figure without a nearby APR (Reg Z / TILA §1026.24)"
        if token == "regz_rate_figure_no_apr"
        else "an unsubstantiated rate self-comparison (CFPB UDAAP)"
    )
    return '⚠ {sev} [rate-claim]: "{matched}" is {label} ("{token}") at offset {idx} → {suggest}'.format(
        sev=severity, matched=matched_text, label=label, token=token, idx=index, suggest=suggest,
    )


# ── Public API (mirror scan.ts) ───────────────────────────────────────────────

def scan_rate_claims(text, severity_floor=None, disclaimer_ranges=None):
    """Scan `text` for Reg-Z rate-figure + UDAAP rate-comparison violations.
    Empty/non-string input returns []. Matches inside a caller-marked
    `disclaimer_ranges` block are excused.

    Each violation dict: token, severity, index, matchedText, suggest, message.
    """
    if not isinstance(text, str) or len(text) == 0:
        return []

    masked = _mask_html(text)
    violations = []

    def push(token, index, matched_text, suggest):
        if _within_any_range(index, disclaimer_ranges):
            return
        severity = _apply_floor(_DEFAULT_SEVERITY, severity_floor)
        violations.append({
            "token": token,
            "severity": severity,
            "index": index,
            "matchedText": matched_text,
            "suggest": suggest,
            "message": _build_message(token, matched_text, index, severity, suggest),
        })

    for (index, matched_text) in _scan_regz(text, masked):
        push("regz_rate_figure_no_apr", index, matched_text, _REGZ_SUGGEST)
    for (index, matched_text) in _scan_udaap(text, masked):
        push("udaap_rate_comparison", index, matched_text, _UDAAP_SUGGEST)

    violations.sort(key=lambda v: (v["index"], v["token"]))
    return violations


def has_rate_claim_violation(text, severity_floor=None, disclaimer_ranges=None):
    """True iff `text` contains at least one Reg-Z / UDAAP rate-claim violation."""
    return len(scan_rate_claims(text, severity_floor=severity_floor, disclaimer_ranges=disclaimer_ranges)) > 0
