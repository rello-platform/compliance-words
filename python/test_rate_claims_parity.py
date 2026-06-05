"""
TS<->Python parity tests for the Reg-Z + UDAAP rate-claim checker (DRAFT).

Mirrors the lane parity discipline (test_lane_parity.py): the vendored Python
`scan_rate_claims` must reproduce the TypeScript `scanRateClaims` verdict-for-
verdict over a shared corpus. The SoT contract is "same matching everywhere, no
re-drift" — the Reg-Z rate-vs-value distinction is the same one Milo's
detectsRateFigure uses.

Runs on stdlib `unittest` (no pytest). Run directly:
    python python/test_rate_claims_parity.py

Coverage:
  (1) PARITY — every shared-corpus case yields identical (token, severity, index)
      tuples from the Python checker and the TS checker (invoked via node over
      the built dist/).
  (2) Python-side positive / false-positive / disclaimer / severity-floor unit
      coverage (runs even when node is unavailable).
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

from rate_claims import scan_rate_claims, has_rate_claim_violation  # noqa: E402

_CORPUS_PATH = os.path.join(_HERE, "rate_claims_parity_corpus.json")
_DIST_INDEX = os.path.join(_ROOT, "dist", "index.js")


def _verdict_tuples(violations):
    return sorted((v["token"], v["severity"], v["index"]) for v in violations)


def _load_corpus():
    with open(_CORPUS_PATH, "r") as fh:
        return json.load(fh)["cases"]


def _ts_verdicts(cases):
    if not os.path.isfile(_DIST_INDEX):
        return None
    script = (
        "import { scanRateClaims } from '%s';"
        "import { readFileSync } from 'node:fs';"
        "const cases = JSON.parse(readFileSync(process.argv[1],'utf8')).cases;"
        "const out = cases.map(c => scanRateClaims(c.text)"
        ".map(v => [v.token, v.severity, v.index]));"
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
    return [sorted(tuple(x) for x in case) for case in raw]


class RateClaimParityCorpus(unittest.TestCase):
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
            py = _verdict_tuples(scan_rate_claims(case["text"]))
            self.assertEqual(
                py, ts[i],
                "PARITY MISMATCH on case %d %r: python=%r ts=%r"
                % (i, case["text"], py, ts[i]),
            )


class RateClaimBehavior(unittest.TestCase):
    def _tokens(self, text, **kw):
        return sorted(v["token"] for v in scan_rate_claims(text, **kw))

    def test_regz_positives(self):
        for t in [
            "I'm offering 6.1% on a 30-year fixed.",
            "a rate of 6.125%",
            "rates near 6%",
            "6.125%.",
        ]:
            self.assertIn("regz_rate_figure_no_apr", self._tokens(t), t)

    def test_regz_apr_present_allows(self):
        for t in ["6.1% APR on a 30-year fixed.", "The annual percentage rate is 6.4% APR."]:
            self.assertNotIn("regz_rate_figure_no_apr", self._tokens(t), t)

    def test_regz_value_figure_allows(self):
        for t in [
            "Prices are up 5% from last year.",
            "Home values rose roughly 5% year over year.",
        ]:
            self.assertEqual(scan_rate_claims(t), [], t)

    def test_regz_lead_owned_rate_allows(self):
        # Kelly ruling 2026-06-03: the lead's OWN existing rate is not an offer.
        for t in [
            "Your current rate is 2.88%, which is great.",
            "You're sitting on a 2.94% rate — hold onto it.",
            "Saw your 6.5% rate alert come through.",
            "Your 2.67% rate is well below today's market.",
            "Their current rate is 3.1% on the existing loan.",
            "The rate you locked at 3.25% is fantastic.",
        ]:
            self.assertNotIn("regz_rate_figure_no_apr", self._tokens(t), t)

    def test_regz_market_and_prospective_offer_still_flag(self):
        for t in [
            "Rates are at 6.4% right now.",
            "30-yr is now 6.4%.",
            "I'm offering 5.5%.",
            "a rate of 6.1%",
            "Your new rate could be 5.5%.",
            "We could get your rate down to 5.5%.",
        ]:
            self.assertIn("regz_rate_figure_no_apr", self._tokens(t), t)

    def test_udaap_positives(self):
        for t in [
            "running below the broader market average",
            "lower than other lenders",
            "we beat any rate",
            "the lowest rate around",
            "40 bps below market",
        ]:
            self.assertIn("udaap_rate_comparison", self._tokens(t), t)

    def test_udaap_data_stat_allows(self):
        for t in [
            "Active listings are up 12% from a year ago.",
            "The median sale price is 5% higher than last year.",
        ]:
            self.assertNotIn("udaap_rate_comparison", self._tokens(t), t)

    def test_severity_default_and_floor(self):
        self.assertEqual(
            [v["severity"] for v in scan_rate_claims("a rate of 6.125%.")],
            ["WARNING"],
        )
        self.assertEqual(
            [v["severity"] for v in scan_rate_claims("a rate of 6.125%.", severity_floor="HARD_BLOCK")],
            ["HARD_BLOCK"],
        )
        self.assertEqual(
            [v["severity"] for v in scan_rate_claims("a rate of 6.125%.", severity_floor="REVIEW_FLAG")],
            ["WARNING"],
        )

    def test_disclaimer_banner(self):
        ref = "Illustrative only: a rate of 6.125%."
        self.assertTrue(has_rate_claim_violation(ref))
        self.assertEqual(scan_rate_claims(ref, disclaimer_ranges=[[0, len(ref)]]), [])

    def test_html_masking(self):
        self.assertIn(
            "regz_rate_figure_no_apr",
            self._tokens("<b>The 30-year fixed is around 5.5%</b> right now."),
        )

    def test_degenerate_input(self):
        self.assertEqual(scan_rate_claims(""), [])
        self.assertEqual(scan_rate_claims(None), [])
        self.assertEqual(scan_rate_claims(12345), [])
        self.assertFalse(has_rate_claim_violation(""))


if __name__ == "__main__":
    unittest.main(verbosity=2)
