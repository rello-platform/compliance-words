# @rello-platform/compliance-words

The canonical **machine source-of-truth** for the M7 borrower-facing
prohibited-language rule. Replaces the ≥6 divergent prose enumerations the rule
used to live in with one structured vocabulary + one context-aware checker, so
every publish/send/generate boundary enforces the same affirmative-vs-NOT-THAT
logic without re-drifting.

> Drift-guard instance **#8** (`~PLATFORM-IDENTIFIER-REGISTRY-GUARD-KIT-README.md`).
> Drift class: *vocabulary-divergence-across-consumers*. **No normalizer** — the
> context-rule model is the boundary logic, not a normalize-fold.

## Install (git-dep, pinned tag)

```jsonc
"@rello-platform/compliance-words": "github:rello-platform/compliance-words#v0.1.2"
```

This package commits `dist/` and has **no `prepare`/`postinstall` hook** (git-dep
discipline — see the platform package-pin convention). It has **zero runtime
dependencies**.

## Usage (TS / ESM)

```ts
import { checkCompliance, hasHardBlock } from "@rello-platform/compliance-words";

const violations = checkCompliance("We guarantee approval.");
// → [{ token: "guarantee", category: "HARD_BLOCK", ... },
//    { token: "approval",  category: "HARD_BLOCK", ... }]

hasHardBlock("This is not a guarantee."); // → false  (negation context)
```

## Usage (CJS)

```js
const { checkCompliance } = require("@rello-platform/compliance-words");
```

Both conditions resolve from the same `exports` map (`import` → `dist/index.js`,
`require` → `dist/index.cjs`). A CJS consumer never hits
`ERR_PACKAGE_PATH_NOT_EXPORTED`.

## The context model (the load-bearing part)

This is **not** a substring scan. A token produces a violation only if it matches
at a word boundary **and** none of its allowed contexts fires:

| Context | Excuses the token when… |
|---|---|
| **negation** | a cue (`not`/`never`/`no`/`isn't`/`won't`…) sits within `proximity` words before the match in the same clause — **or**, since v0.1.1, within the wider `listNegationProximity` window when a comma/`or`/`nor` coordinator lies between the cue and the match, so a single cue distributes over a coordinated NOT-THAT list (`"never call it an offer, a quote, an approval, a lock, or a pre-qualification"`). The scan stops at a sentence terminator **or** a clause breaker (`so`, `but`, `because`…), so a negation never crosses into a later clause. |
| **compound** | the match is inside a registered fixed term (`"guarantee fee"`, `"hud-approved"`, `"rate-lock confirmation"`, `"final disclosure"`). |
| **disclaimer-banner** | the match offset is inside a caller-supplied `disclaimerRanges` block (illustrative banners). **Fail-safe-strict**: an unmarked banner still HARD_BLOCKs. (`guarantee` and `pre-qualified` gained this allowance in v0.1.1.) |

`word-stem`/`word` forms match at word boundaries (so `quote` ≠ `quotient`,
`lock` ≠ `block`, `final` ≠ `finalize`); `AI` is matched **case-sensitively**
(`OpenAI`/`email` never match). HTML tags are masked before matching, so
`<b>guarantee</b>` is caught while a token inside a URL/attribute is ignored.

`offer` is a **phrase** matched only on its promotional collocations (`"special
offer"`, `"limited-time offer"`, `"offer expires"`, …) — ordinary verb/participle
uses (`"your offered rate"`, `"offer to include the family"`) are **not** flagged
(v0.1.1 Gap 2).

### v0.1.2 — Kelly's compliance rulings (2026-06-01)

Two additive **compound** allowances (no new mechanism — both ride the existing
`compound` context, the SoT is just told which fixed collocations are legitimate):

- **`pre-qualification` / `prequalification` (the product-name NOUN) is identity, not a claim.**
  The PathfinderPro "Pre-Qualification Summary" document, its section/status
  labels, and prose self-references ("this pre-qualification is based on…", "an
  official pre-qualification") name the product/feature. The grammatical split is
  reliable: the **-ion noun** names the product (allowed); the **-ed adjective/verb**
  applied to the borrower (`"you're pre-qualified"`, `"get pre-qualified"`) is the
  prohibited inducement and **still HARD_BLOCKs**. *(Residual: the 3rd-person status
  sentence "<borrower> is pre-qualified" uses the adjective and stays in scope so
  the 2nd-person claim cannot slip.)*
- **Institutional approval-gate disclaimers are protective, not advertising.**
  `"underwriting approval"`, `"credit approval"`, `"lender approval"`, and
  `"approval is not guaranteed"` are compliance-required disclaimer collocations
  ("subject to underwriting approval", "lender approval required"). They are
  registered narrowly so the genuine promotional claim still blocks: `"loan
  approval"` ("Get loan approval today"), bare `"approved"` ("you're approved!"),
  and `"guarantee approval"` carry no gate compound and remain HARD_BLOCK.

### Audience scope — borrower-facing only (ruling 3)

M7 is a **borrower-facing advertising** rule. **Internal broker / back-office /
audit documents are out of scope** — a broker closing-audit packet that records an
"Approved" loan-approval *status*, a broker→title commission disbursement, a
broker→agent commission statement, etc. are not borrower advertising and must not
be linted by the M7 gate.

This package is a pure text-in → violations-out checker; it cannot know a string's
audience. **Audience classification is the consumer's responsibility** and lives at
the gate, not in the vocabulary. The convention:

- The consumer marks each lintable surface as **borrower-facing** (the default —
  fail-safe-strict: an unclassified surface is treated as borrower-facing and IS
  linted) or **internal** (explicitly opted out).
- The gate skips internal surfaces *before* calling `checkCompliance`, and **logs
  what it skipped** (no silent scope-narrowing).
- Grounding the line per consumer: Report-Engine declares a module-level
  `AUDIENCE = "internal"` on internal template modules (closing-audit-packet,
  commission-disbursement-authorization, agent-commission-statement); Rello scopes
  by `HecmContent` audience; Milo lints only borrower-facing generated copy.

## Categories

- **HARD_BLOCK** — reject (every token except `final`).
- **REVIEW_FLAG** — warn + allow + surface (`final`).

## Cross-language consumers

The committed `dist/compliance-words-keyset.json` carries the **full vocabulary +
context model** (forms, matchType, category, allowedContexts, negation cues,
default + list proximity, clause breakers, list coordinators, sentence
terminators) so a non-TS consumer (the Python Report-Engine) re-implements
`check_compliance` over the same source of truth.
Import the subpath:

```jsonc
"@rello-platform/compliance-words/compliance-words-keyset.json"
```

## Develop

```bash
npm install
npm run build      # tsup → dist/ (ESM + CJS + d.ts) + emits the keyset
npm test           # build + node --test (completeness + live-evidence + edge cases)
npm run typecheck
```

`dist/` is committed; rebuild and commit it whenever `src/` changes.

## Provenance

Built from `RELLO TO BE BUILT/_SPEC-M7-COMPLIANCE-WORDS-SOT.md` (Phase 1). The
human-readable policy lives in
`App Development Docs for Rello Platform/10-COMMUNICATION-GUARDRAILS.md`
§ Prohibited Language (M7), which points here as the machine SoT.
