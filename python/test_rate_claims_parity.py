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

import html.entities
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile
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


def _ts_verdicts(cases, corpus_path=_CORPUS_PATH):
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
            ["node", "--input-type=module", "-e", script, corpus_path],
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
                "still run; build the package (npm run compile) to exercise parity."
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
            "a 30-year at 6.1%",
            "a rate of 6.125%",
            "rates near 6%",
            "6.125%.",  # three decimals (K-13)
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
            # K-13: the rate noun must govern (<=1 preposition/verb between) or three decimals.
            "Rates at 6.4% right now.",
            "the 30-year is 6.4%.",
            "I'm offering a rate of 5.5%.",
            "a rate of 6.1%",
            "Your new rate is 5.5%.",
            "We could get your rate to 5.5%.",
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
            self._tokens("<b>The 30-year fixed is 5.5%</b> right now."),
        )

    def test_k13_eight_fixtures_and_releases(self):
        # Rello #1327's ruling fixtures + the Big Star span (K-30).
        for t in ["rate of 6.75%", "rates near 6.75%", "a fixed 7 % loan", "the 30-year is sitting at 6.990%"]:
            self.assertIn("regz_rate_figure_no_apr", self._tokens(t), t)
        self.assertNotIn("regz_rate_figure_no_apr", self._tokens("6.99% APR"))
        for t in ["values are up about 2.4%", "up around 2.4%", "mortgage applications rose 5%",
                  "Values across Sandy are up 2.4% year over year (Zillow home-value index, as of July 2026), even as mortgage rates hold steady.",
                  # A7 still releases: figure-first beyond one word, and "30-yr" is not a rate noun
                  "I'm offering 6.1% on a 30-year fixed.", "30-yr is now 6.4%."]:
            self.assertNotIn("regz_rate_figure_no_apr", self._tokens(t), t)

    def test_a7_bounded_connective_phrase(self):
        # A7 (2026-09-24): noun, up to RATE_PHRASE_MAX_WORDS connectives, figure.
        for t in ["Rates are around 6.25% right now.", "the 30-year fixed is sitting around 5.5% right now",
                  "Rates are at 6.4% right now.", "Your new rate could be 5.5%.",
                  "Rates have been hovering around 6.5% this month."]:
            self.assertIn("regz_rate_figure_no_apr", self._tokens(t), t)
        for t in ["Rate cuts lifted sales 5% last quarter.", "Fixed costs rose 3% this year.",
                  "Rates have still been hovering around 6.5% lately."]:
            self.assertNotIn("regz_rate_figure_no_apr", self._tokens(t), t)

    def test_d70_movement_is_not_a_rate(self):
        # D-70 (A-178): a movement verb with no level word after it is a delta.
        for t in ["Rates are down 3%", "Rates have dropped roughly 0.5%", "Rates fell 3%",
                  "The 15-year fell by 0.3%.", "Rates are down about 0.5% from last month."]:
            self.assertNotIn("regz_rate_figure_no_apr", self._tokens(t), t)
        for t in ["Rates fell to 6.1%", "Rates are down to 6.1%.", "the 30-year is 6.3% today",
                  "Your new rate could be 5.9%", "Rates rose 0.125% this week.", "Rates sit near 6.4% after the dip."]:
            self.assertIn("regz_rate_figure_no_apr", self._tokens(t), t)
        # the delta releases, the level after it is kept
        self.assertEqual(len([v for v in scan_rate_claims("Rates are down 0.5% to 6.1%.") if v["token"] == "regz_rate_figure_no_apr"]), 1)

    def test_degenerate_input(self):
        self.assertEqual(scan_rate_claims(""), [])
        self.assertEqual(scan_rate_claims(None), [])
        self.assertEqual(scan_rate_claims(12345), [])
        self.assertFalse(has_rate_claim_violation(""))


# ── Ruling 297 (LA23-48): every HTML entity decodes, TS and Python alike ──────
def _entity_sweep_texts():
    refs = ["&" + name for name in sorted(html.entities.html5)]
    # A legacy name HTML accepts bare is the longest prefix of a longer run ("&notit;" -> "\u00acit;").
    refs += ["&" + name + "zz;" for name in sorted(html.entities.html5) if not name.endswith(";")]
    code_points = list(range(0, 0x200)) + list(range(0x2000, 0x2070)) + [
        0xFEFF, 0xFFFD, 0xD800, 0xDFFF, 0x1D504, 0x1F600, 0x10FFFF, 0x110000, 10 ** 12]
    for cp in code_points:
        refs += ["&#%d;" % cp, "&#%d" % cp, "&#x%x;" % cp, "&#X%X" % cp]
    refs += ["&#0000000000160;", "&#x" + "0" * 40 + "a0;", "&#" + "9" * 5000 + ";", "&#x;", "&#;", "&bogus;", "&MDash;"]
    return ["Our rate%s6.25%% and %srates at 6.5%%%s today" % (r, r, r) for r in refs]


def _load_generator():
    spec = importlib.util.spec_from_file_location("gen_html_entities", os.path.join(_ROOT, "scripts", "gen-html-entities.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class EntityDecodeParity(unittest.TestCase):
    def test_generated_table_is_current(self):
        gen = _load_generator()
        with open(gen.OUT, "r", encoding="utf-8") as fh:
            self.assertEqual(fh.read(), gen.render(), "src/html-entities.ts is stale: run python3 scripts/gen-html-entities.py")

    def test_ts_decodes_every_entity_as_python_does(self):
        # The TS scanner must read each entity text exactly as it reads Python's
        # masked text for it (same length, so the same offsets). That isolates the
        # decoders from the regex dialects: Python's \b and [a-z] (re.I) are
        # Unicode-aware and JS's are not, so a decoded "\u00c6" can already split
        # the two languages on raw text, with or without an entity.
        from rate_claims import _mask_html
        texts = _entity_sweep_texts()
        # An astral character is one code point here and two UTF-16 units in JS, so
        # Python's run carries one more pad space before it than the TS run does.
        masked = [re.sub("( )([\U00010000-\U0010FFFF])", r"\2", _mask_html(t)) for t in texts]
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump({"cases": [{"text": t} for t in texts + masked]}, fh)
            path = fh.name
        try:
            ts = _ts_verdicts(texts + masked, path)
        finally:
            os.unlink(path)
        if ts is None:
            self.skipTest("node or dist/index.js unavailable — build the package (npm run compile).")
        n = len(texts)
        self.assertEqual(len(ts), 2 * n)
        mismatches = [(texts[i], ts[i], ts[n + i]) for i in range(n) if ts[i] != ts[n + i]]
        self.assertEqual(mismatches[:5], [], "%d of %d entity texts decode differently" % (len(mismatches), n))


class EntityDecodeBehavior(unittest.TestCase):
    def _regz(self, text):
        return len([v for v in scan_rate_claims(text) if v["token"] == "regz_rate_figure_no_apr"])

    def test_auditor_cases_read_as_rendered(self):
        for entity, rendered in [
            ("Our rate&mdash;6.25%", "Our rate\u20146.25%"),
            ("Our rate&ndash;6.25%", "Our rate\u20136.25%"),
            ("Our rate is &quot;6.25%&quot;", 'Our rate is "6.25%"'),
            ("Our rate&#8203;6.25%", "Our rate\u200b6.25%"),
            ("rate of&nbsp6.5%", "rate of 6.5%"),
            ("the 30-year is at 6.5&#37 today", "the 30-year is at 6.5% today"),
            ("Our rate&#151;6.25%", "Our rate\u20146.25%"),
        ]:
            self.assertEqual(self._regz(entity), self._regz(rendered), entity)
            self.assertEqual(self._regz(entity), 1, entity)
        # Not an HTML entity (names are case-sensitive); a legacy prefix leaves its ";" visible.
        self.assertEqual(self._regz("rate of&NBSP;6.5%"), 0)
        self.assertEqual(self._regz("Our rate&notit;6.25%"), 0)

    def test_mask_decodes_as_html_does(self):
        from rate_claims import _mask_html
        for ref, run in [
            ("&mdash;", "      \u2014"), ("&#151;", "     \u2014"), ("&#x96;", "     \u2013"),
            ("&#129;", "      "), ("&#0;", "   \ufffd"), ("&#xD800;", "       \ufffd"),
            ("&#x110000;", "         \ufffd"), ("&nbsp", "     "), ("&#8203;", "       "),
            ("&notit;", "   \u00acit;"), ("&NBSP;", "&NBSP;"), ("&bogus;", "&bogus;"),
        ]:
            self.assertEqual(_mask_html(ref), run, ref)

    def test_mask_keeps_every_offset(self):
        from rate_claims import _mask_html
        for text in _entity_sweep_texts():
            self.assertEqual(len(_mask_html(text)), len(text), text[:60])
        plain = "Rates fell 3% this month; today's 30-year fixed is 6.25% (6.41% APR)."
        self.assertEqual(_mask_html(plain), plain)


if __name__ == "__main__":
    unittest.main(verbosity=2)
