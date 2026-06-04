/**
 * Run the Python TS<->Python lane-parity suite as part of `npm test`.
 *
 * The lane checker is a cross-language SoT (the keyset JSON is read by both the
 * TS `scanLaneViolations` and the Python `python/lane_checker.py`). The parity
 * test (`python/test_lane_parity.py`) runs every shared-corpus case through BOTH
 * languages and asserts identical verdicts — the same discipline as the M7
 * Report-Engine parity suite.
 *
 * This runner invokes `python3` (or `python`) on the parity test. If no Python
 * interpreter is on PATH (e.g. a minimal Node-only CI runner), it PRINTS A LOUD
 * NOTICE and exits 0 — the TS suite already ran and proved the TS side; the
 * Python interpreter being absent is an environment gap, not a code failure.
 * When Python IS present, a parity failure exits non-zero and fails `npm test`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const test = join(root, "python", "test_lane_parity.py");

if (!existsSync(test)) {
  console.error(`[parity] python/test_lane_parity.py not found at ${test}`);
  process.exit(1);
}

function findPython() {
  for (const bin of ["python3", "python"]) {
    const probe = spawnSync(bin, ["--version"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) return bin;
  }
  return null;
}

const py = findPython();
if (!py) {
  console.warn(
    "[parity] NOTICE: no python3/python on PATH — skipping the TS<->Python lane " +
      "parity run. The TS lane suite already passed; install Python to exercise " +
      "cross-language parity locally (it is enforced wherever Python is present).",
  );
  process.exit(0);
}

const res = spawnSync(py, [test], { cwd: root, stdio: "inherit" });
if (res.error) {
  console.error("[parity] failed to launch Python:", res.error.message);
  process.exit(1);
}
process.exit(res.status ?? 1);
