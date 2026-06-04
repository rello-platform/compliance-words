"""
Reference Python re-implementation of the role-aware LANE checker — the Python
half of the cross-language @rello-platform/compliance-words source-of-truth
(Platform Guard-Kit §7), for the lane (cross-lane / "stay in your lane") rules.

This is a faithful port of the TypeScript `scanLaneViolations`
(@rello-platform/compliance-words `src/lanes/scan.ts`) and reuses a port of the
shared match engine (`src/match-engine.ts`). It reads the SAME vendored
`compliance-words-keyset.json` the M7 Python checker reads (Report-Engine
`app/compliance/checker.py`) — it does NOT re-author the lane vocabulary. The
keyset's `laneEntries` + `laneConfig` carry the full lane vocabulary + context
model so this scanner is identical to the TS scanner; the parity corpus in
`tests/test_lane_parity.py` (run via the package's parity harness) re-asserts
that verdict-for-verdict.

A lane row produces a LaneViolation ONLY IF it matches at a word boundary AND
none of its allowedContexts fires (negation / compound / caller-marked
disclaimer range) AND its `lane` is out-of-lane for the caller's role. DRAFT
posture: every row is WARNING; this scanner never blocks on its own.

Pure functions over text — no I/O at call time (the keyset is loaded once at
import), no throw on bad input.
"""

import json
import os
import re

_HERE = os.path.dirname(os.path.abspath(__file__))
# Default to a sibling dist artifact; a consumer (Report-Engine) overrides via
# COMPLIANCE_WORDS_KEYSET_PATH or by vendoring the file next to its checker.
_DEFAULT_KEYSET = os.path.normpath(
    os.path.join(_HERE, "..", "dist", "compliance-words-keyset.json")
)

# ── Matching primitives (mirror src/match-engine.ts exactly) ─────────────────

_WORD_CHAR = "A-Za-z0-9"
_BOUNDARY_BEFORE = r"(?<![{}])".format(_WORD_CHAR)
_BOUNDARY_AFTER = r"(?![{}])".format(_WORD_CHAR)
_SEP = r"[^{}]+".format(_WORD_CHAR)
_SENTENCE_TERMINATOR = re.compile(r"[.!?;\n]")
_WORD_RE = re.compile("[A-Za-z0-9'‘’]+")
_HTML_TAG_RE = re.compile(r"<[^>]*>")


def _escape_regex(s):
    return re.sub(r"([.*+?^${}()|\[\]\\])", r"\\\1", s)


def _normalize_apostrophe(s):
    return re.sub("[‘’ʼ]", "'", s)


def _compile_phrase_pattern(phrase):
    out = [_BOUNDARY_BEFORE]
    pending_sep = False
    for ch in phrase:
        if re.match(r"[A-Za-z0-9]", ch):
            if pending_sep:
                out.append(_SEP)
                pending_sep = False
            out.append(_escape_regex(ch))
        elif ch in "'‘’":
            out.append("['‘’]?")
        else:
            pending_sep = True
    out.append(_BOUNDARY_AFTER)
    return "".join(out)


def _compile_form_pattern(form, match_type):
    if match_type == "phrase":
        return _compile_phrase_pattern(form)
    return _BOUNDARY_BEFORE + _escape_regex(form) + _BOUNDARY_AFTER


def _load_keyset(path=None):
    with open(path or os.environ.get("COMPLIANCE_WORDS_KEYSET_PATH") or _DEFAULT_KEYSET, "r") as fh:
        return json.load(fh)


_KEYSET = _load_keyset()
_NEGATION_SET = set(_KEYSET["negationCues"])
_DEFAULT_NEGATION_PROXIMITY = int(_KEYSET["defaultNegationProximity"])
_DEFAULT_LIST_NEGATION_PROXIMITY = int(
    _KEYSET.get("listNegationProximity", _DEFAULT_NEGATION_PROXIMITY)
)
_CLAUSE_BREAKER_SET = set(_KEYSET.get("clauseBreakers", []))
_LIST_COORDINATOR_SET = set(_KEYSET.get("listCoordinators", []))

_LANE_CONFIG = _KEYSET.get("laneConfig", {})
_ROLE_LANE_MAP = _LANE_CONFIG.get(
    "roleLaneMap",
    {"AGENT": ["AGENT_LANE_VIOLATION"], "MLO": ["MLO_LANE_VIOLATION"], "DUAL": []},
)

_SEVERITY_RANK = {"REVIEW_FLAG": 0, "WARNING": 1, "HARD_BLOCK": 2}


class _CompiledLane(object):
    __slots__ = (
        "entry",
        "token_regex",
        "compound_regexes",
        "has_negation",
        "negation_proximity",
        "list_negation_proximity",
        "has_disclaimer",
    )


def _compile_lane_registry(keyset):
    compiled = []
    for entry in keyset.get("laneEntries", []):
        match_type = entry["matchType"]
        case_sensitive = match_type == "word"
        flags = 0 if case_sensitive else re.IGNORECASE
        token_pattern = "|".join(
            _compile_form_pattern(f, match_type) for f in entry["forms"]
        )
        contexts = entry.get("allowedContexts", [])
        compound_regexes = [
            re.compile(_compile_phrase_pattern(c["pattern"]), re.IGNORECASE)
            for c in contexts
            if c["kind"] == "compound"
        ]
        negation = next((c for c in contexts if c["kind"] == "negation"), None)
        ce = _CompiledLane()
        ce.entry = entry
        ce.token_regex = re.compile(token_pattern, flags)
        ce.compound_regexes = compound_regexes
        ce.has_negation = negation is not None
        ce.negation_proximity = (
            int(negation.get("proximity", _DEFAULT_NEGATION_PROXIMITY))
            if negation
            else _DEFAULT_NEGATION_PROXIMITY
        )
        ce.list_negation_proximity = _DEFAULT_LIST_NEGATION_PROXIMITY
        ce.has_disclaimer = any(c["kind"] == "disclaimer-banner" for c in contexts)
        compiled.append(ce)
    return compiled


_COMPILED = _compile_lane_registry(_KEYSET)


# ── HTML masking + word index (mirror match-engine.ts) ───────────────────────

def _mask_html(text):
    return _HTML_TAG_RE.sub(lambda m: " " * len(m.group(0)), text)


class _Word(object):
    __slots__ = ("text", "start", "end")

    def __init__(self, text, start, end):
        self.text = text
        self.start = start
        self.end = end


def _index_words(masked):
    return [_Word(m.group(0), m.start(), m.end()) for m in _WORD_RE.finditer(masked)]


def _word_index_for_match(words, offset):
    for i, w in enumerate(words):
        if offset < w.end:
            return i
    return len(words)


def _is_negated(masked, words, match_offset, proximity, list_proximity):
    w = _word_index_for_match(words, match_offset)
    saw_coordinator = False
    floor = max(0, w - list_proximity)
    j = w - 1
    while j >= floor:
        nxt = words[j + 1] if (j + 1) < len(words) else None
        right_edge = nxt.start if nxt else match_offset
        gap = masked[words[j].end:right_edge]
        if _SENTENCE_TERMINATOR.search(gap):
            break
        if "," in gap:
            saw_coordinator = True
        cue = _normalize_apostrophe(words[j].text.lower()).strip("'")
        if cue in _CLAUSE_BREAKER_SET:
            break
        if cue in _NEGATION_SET:
            dist = w - j
            if dist <= proximity:
                return True
            if saw_coordinator:
                return True
            break
        if cue in _LIST_COORDINATOR_SET:
            saw_coordinator = True
        j -= 1
    return False


def _within_any_range(offset, ranges):
    if not ranges:
        return False
    return any(offset >= start and offset < end for start, end in ranges)


def _within_any_compound(offset, spans):
    return any(offset >= start and offset < end for start, end in spans)


def _lanes_for_role(role):
    if role in _ROLE_LANE_MAP:
        return list(_ROLE_LANE_MAP[role])
    # Fail-safe-strict: an unknown role applies BOTH lanes (mirror scan.ts).
    return ["AGENT_LANE_VIOLATION", "MLO_LANE_VIOLATION"]


def _apply_floor(row_severity, floor):
    if not floor:
        return row_severity
    return floor if _SEVERITY_RANK[floor] > _SEVERITY_RANK[row_severity] else row_severity


def _build_message(entry, matched_text, index, severity):
    lane_label = (
        "MLO-only language in an agent's copy"
        if entry["lane"] == "AGENT_LANE_VIOLATION"
        else "agent-only language in an MLO's copy"
    )
    base = (
        '⚠ {sev} [lane]: "{matched}" is {label} ("{token}") '
        "at offset {idx}".format(
            sev=severity, matched=matched_text, label=lane_label,
            token=entry["token"], idx=index,
        )
    )
    suggest = entry.get("suggest")
    if suggest:
        return "{base} → {suggest}".format(base=base, suggest=suggest)
    return base


# ── Public API (mirror scan.ts) ───────────────────────────────────────────────

def scan_lane_violations(text, role, disclaimer_ranges=None, severity_floor=None):
    """Scan `text` for cross-lane language the sender's `role` may not use.
    Empty/non-string input returns [] (no throw). DUAL returns [].

    Each violation dict: token, lane, severity, index, matchedText, suggest,
    message.
    """
    if not isinstance(text, str) or len(text) == 0:
        return []

    applicable = set(_lanes_for_role(role))
    if not applicable:
        return []

    masked = _mask_html(text)
    words = _index_words(masked)
    violations = []

    for compiled in _COMPILED:
        entry = compiled.entry
        if entry["lane"] not in applicable:
            continue

        compound_spans = []
        for cre in compiled.compound_regexes:
            for cm in cre.finditer(masked):
                compound_spans.append((cm.start(), cm.end()))

        for m in compiled.token_regex.finditer(masked):
            index = m.start()
            matched_text = text[index:index + len(m.group(0))]

            if _within_any_compound(index, compound_spans):
                continue
            if compiled.has_disclaimer and _within_any_range(index, disclaimer_ranges):
                continue
            if compiled.has_negation and _is_negated(
                masked, words, index, compiled.negation_proximity,
                compiled.list_negation_proximity,
            ):
                continue

            severity = _apply_floor(entry["severity"], severity_floor)
            violations.append({
                "token": entry["token"],
                "lane": entry["lane"],
                "severity": severity,
                "index": index,
                "matchedText": matched_text,
                "suggest": entry.get("suggest"),
                "message": _build_message(entry, matched_text, index, severity),
            })

    violations.sort(key=lambda v: (v["index"], v["token"]))
    return violations


def has_lane_violation(text, role, disclaimer_ranges=None):
    """True iff `text` contains at least one lane violation for `role`."""
    return len(scan_lane_violations(text, role, disclaimer_ranges=disclaimer_ranges)) > 0
