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
"@rello-platform/compliance-words": "github:rello-platform/compliance-words#v0.1.0"
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
| **negation** | a cue (`not`/`never`/`no`/`isn't`/`won't`…) sits within `proximity` words before the match, in the same sentence (`"not a guarantee"`). |
| **compound** | the match is inside a registered fixed term (`"usda guarantee fee"`, `"rate-lock confirmation"`, `"final disclosure"`). |
| **disclaimer-banner** | the match offset is inside a caller-supplied `disclaimerRanges` block (illustrative banners). **Fail-safe-strict**: an unmarked banner still HARD_BLOCKs. |

`word-stem`/`word` forms match at word boundaries (so `quote` ≠ `quotient`,
`lock` ≠ `block`, `final` ≠ `finalize`); `AI` is matched **case-sensitively**
(`OpenAI`/`email` never match). HTML tags are masked before matching, so
`<b>guarantee</b>` is caught while a token inside a URL/attribute is ignored.

## Categories

- **HARD_BLOCK** — reject (every token except `final`).
- **REVIEW_FLAG** — warn + allow + surface (`final`).

## Cross-language consumers

The committed `dist/compliance-words-keyset.json` carries the **full vocabulary +
context model** (forms, matchType, category, allowedContexts, negation cues,
default proximity, sentence terminators) so a non-TS consumer (the Python
Report-Engine) re-implements `check_compliance` over the same source of truth.
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
