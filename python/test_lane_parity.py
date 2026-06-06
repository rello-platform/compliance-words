"""
TS<->Python parity tests for the role-aware LANE checker.

Mirrors the M7 cross-language parity discipline (Report-Engine
tests/test_m7_lint.py ParityCorpus): the vendored Python `scan_lane_violations`
must reproduce the TypeScript `scanLaneViolations` verdict-for-verdict over a
shared corpus. The SoT contract is "same matching everywhere, no re-drift" — the
keyset JSON is the single source both languages read.

Runs on stdlib `unittest` (no pytest), matching the platform Python convention.
Run directly:   python python/test_lane_parity.py
or discovered:  python -m unittest python.test_lane_parity -v

Coverage:
  (1) PARITY — every shared-corpus case yields identical (token, lane, severity,
      index) tuples from the Python checker and the TS checker (invoked via node
      over the built dist/). This is the load-bearing cross-language gate.
  (2) Python-side positive / false-positive / DUAL / fail-safe / negation /
      disclaimer / severity-floor unit coverage (independent of the TS run, so
      the suite still proves the Python behavior even if node is unavailable —
      that case is reported as a skipped parity layer, not a silent pass).
"""

import json
import os
import subprocess
import sys
import unittest

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.normpath(os.path.join(_HERE, ".."))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from lane_checker import scan_lane_violations, has_lane_violation  # noqa: E402

_CORPUS_PATH = os.path.join(_HERE, "parity_corpus.json")
_DIST_INDEX = os.path.join(_ROOT, "dist", "index.js")


def _verdict_tuples(violations):
    """Reduce a list of violation dicts to the comparable parity signature."""
    return sorted(
        (v["token"], v["lane"], v["severity"], v["index"]) for v in violations
    )


def _load_corpus():
    with open(_CORPUS_PATH, "r") as fh:
        return json.load(fh)["cases"]


def _ts_verdicts(cases):
    """Run every corpus case through the TS scanLaneViolations via a one-shot
    node invocation over the built dist/. Returns a list of verdict-tuple lists
    aligned to `cases`, or None if node/dist is unavailable."""
    if not os.path.isfile(_DIST_INDEX):
        return None
    script = (
        "import { scanLaneViolations } from '%s';"
        "import { readFileSync } from 'node:fs';"
        "const cases = JSON.parse(readFileSync(process.argv[1],'utf8')).cases;"
        "const out = cases.map(c => scanLaneViolations(c.text, c.role)"
        ".map(v => [v.token, v.lane, v.severity, v.index]));"
        "process.stdout.write(JSON.stringify(out));"
    ) % _DIST_INDEX.replace("\\", "/")
    try:
        res = subprocess.run(
            ["node", "--input-type=module", "-e", script, _CORPUS_PATH],
            capture_output=True, text=True, timeout=60,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if res.returncode != 0:
        raise AssertionError("TS verdict harness failed:\n%s" % res.stderr)
    raw = json.loads(res.stdout)
    # Normalize each TS verdict list into the same sorted-tuple signature.
    return [sorted(tuple(x) for x in case) for case in raw]


class LaneParityCorpus(unittest.TestCase):
    def setUp(self):
        self.cases = _load_corpus()

    def test_ts_python_parity(self):
        ts = _ts_verdicts(self.cases)
        if ts is None:
            self.skipTest(
                "node or dist/index.js unavailable — Python-side unit tests below "
                "still run; build the package (npm run build) to exercise parity."
            )
        self.assertEqual(len(ts), len(self.cases))
        for i, case in enumerate(self.cases):
            py = _verdict_tuples(
                scan_lane_violations(case["text"], case["role"])
            )
            self.assertEqual(
                py, ts[i],
                "PARITY MISMATCH on case %d %r (role=%s): python=%r ts=%r"
                % (i, case["text"], case["role"], py, ts[i]),
            )


class LaneBehavior(unittest.TestCase):
    """Python-side behavior (runs even when node is unavailable)."""

    def _tokens(self, text, role, **kw):
        return sorted(v["token"] for v in scan_lane_violations(text, role, **kw))

    def test_agent_lane_positives(self):
        self.assertEqual(self._tokens("Lock your rate today!", "AGENT"), ["lock your rate"])
        self.assertEqual(self._tokens("You qualify for a loan up to $400k.", "AGENT"), ["you qualify for"])
        self.assertEqual(self._tokens("Your rate will be 5.9%.", "AGENT"), ["rate offer"])
        self.assertEqual(self._tokens("You are pre-approved for a mortgage!", "AGENT"), ["approved for a loan"])
        self.assertEqual(self._tokens("Refinance with me and save.", "AGENT"), ["refinance with me"])
        self.assertEqual(self._tokens("I recommend an FHA loan.", "AGENT"), ["recommend a loan product"])
        self.assertEqual(self._tokens("Apply for a loan with me today.", "AGENT"), ["apply for a loan with me"])
        self.assertEqual(self._tokens("Your monthly payment will be low.", "AGENT"), ["apr trigger term"])

    def test_agent_lane_false_positive_controls(self):
        for t in [
            "Today's 30-year rates are around 6% per Freddie Mac.",
            "When rates drop, refinancing may make sense — ask your loan officer.",
            "Your offer was approved by the seller!",
            "FHA, VA, and conventional loans are all options your lender can explain.",
            "Please lock the front door after the showing.",
            "I am not your loan officer and cannot lock your rate — talk to your MLO.",
            "You qualify for a property-tax exemption this year.",
        ]:
            self.assertEqual(scan_lane_violations(t, "AGENT"), [], "expected clean: %r" % t)

    def test_agent_rate_offer_own_rate_escape_allows(self):
        # OWN-RATE escape (v0.5.0, Kelly ruling): a factual reference to the lead's
        # OWN existing rate is NOT a cross-lane rate offer — these must NOT flag.
        for t in [
            "Justin, your rate is kind of a big deal. Your current rate is sitting at 2.88%.",
            "Your rate is still one of the best out there. You're sitting on a 2.94% rate.",
            "Your current rate is 2.88%.",
            "Saw your 6.5% rate alert come through.",
            "Their current rate is 3.1% on the existing loan.",
        ]:
            self.assertNotIn("rate offer", self._tokens(t, "AGENT"), "expected NO rate-offer flag (own rate): %r" % t)

    def test_agent_rate_offer_real_offers_still_flag(self):
        # A real prospective rate OFFER must STILL flag even with a possessive
        # "your" (the shared OFFER_CUES override the own-rate escape).
        self.assertIn("rate offer", self._tokens("Your rate will be 5.5%.", "AGENT"))
        self.assertIn("rate offer", self._tokens("Your rate would be 5.5% after closing.", "AGENT"))
        self.assertIn("rate offer", self._tokens("I can offer you a rate of 5.5%.", "AGENT"))
        self.assertIn("rate offer", self._tokens("We can offer you a rate of 6.1%.", "AGENT"))
        # Other lane rows are unaffected by the own-rate escape near an own-rate phrase.
        self.assertIn("lock your rate", self._tokens("Your current rate is 2.88% — let's lock your rate.", "AGENT"))

    def test_mlo_lane_positives(self):
        self.assertEqual(self._tokens("List your home with me!", "MLO"), ["list your home with me"])
        self.assertEqual(self._tokens("I will sell your home fast.", "MLO"), ["i'll sell your home"])
        self.assertEqual(self._tokens("As your real estate agent, I'll guide you.", "MLO"), ["i'm your real estate agent"])
        self.assertEqual(self._tokens("Let me show you homes this weekend.", "MLO"), ["let me show you homes"])
        self.assertEqual(self._tokens("Check out my listings!", "MLO"), ["my listings"])
        self.assertEqual(self._tokens("Get your free CMA today.", "MLO"), ["free cma to list"])
        self.assertEqual(self._tokens("I can represent you in the purchase.", "MLO"), ["represent you in the purchase or sale"])

    def test_mlo_lane_false_positive_controls(self):
        for t in [
            "Homes are selling quickly in your area.",
            "Your real estate agent can help you list your home.",
            "A comparative market analysis (CMA) estimates your home's value.",
            "When you sell your home, the proceeds can pay off your loan.",
            "Here is my listing of the documents we need for your loan.",
            "There are many listings on the MLS right now.",
            "I am not your real estate agent — I am your loan officer.",
        ]:
            self.assertEqual(scan_lane_violations(t, "MLO"), [], "expected clean: %r" % t)

    def test_role_isolation(self):
        mixed = "List your home with me and lock your rate."
        self.assertEqual(self._tokens(mixed, "AGENT"), ["lock your rate"])
        self.assertEqual(self._tokens(mixed, "MLO"), ["list your home with me"])

    def test_dual_skips(self):
        mixed = "List your home with me and lock your rate."
        self.assertEqual(scan_lane_violations(mixed, "DUAL"), [])
        self.assertFalse(has_lane_violation(mixed, "DUAL"))

    def test_unknown_role_fail_safe_strict(self):
        mixed = "List your home with me and lock your rate."
        self.assertEqual(self._tokens(mixed, "BOGUS"), ["list your home with me", "lock your rate"])

    def test_severity_default_and_floor(self):
        self.assertEqual(
            [v["severity"] for v in scan_lane_violations("Lock your rate today.", "AGENT")],
            ["WARNING"],
        )
        self.assertEqual(
            [v["severity"] for v in scan_lane_violations("Lock your rate today.", "AGENT", severity_floor="HARD_BLOCK")],
            ["HARD_BLOCK"],
        )
        # floor cannot LOWER
        self.assertEqual(
            [v["severity"] for v in scan_lane_violations("Lock your rate today.", "AGENT", severity_floor="REVIEW_FLAG")],
            ["WARNING"],
        )

    def test_disclaimer_banner(self):
        ref = "For loan questions, your loan officer can help you apply for a loan with me."
        self.assertEqual(self._tokens(ref, "AGENT"), ["apply for a loan with me"])
        self.assertEqual(scan_lane_violations(ref, "AGENT", disclaimer_ranges=[[0, len(ref)]]), [])

    def test_html_masking(self):
        self.assertEqual(self._tokens("<b>Lock your rate</b> now!", "AGENT"), ["lock your rate"])
        self.assertEqual(scan_lane_violations('<a href="https://x.com/lock-your-rate">info</a>', "AGENT"), [])

    def test_degenerate_input(self):
        self.assertEqual(scan_lane_violations("", "AGENT"), [])
        self.assertEqual(scan_lane_violations(None, "AGENT"), [])
        self.assertEqual(scan_lane_violations(12345, "MLO"), [])
        self.assertFalse(has_lane_violation("", "AGENT"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
