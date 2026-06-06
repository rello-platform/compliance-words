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
| **own-rate** *(lane checker only, v0.5.0)* | the match references the lead's **OWN existing rate** (`OWN_RATE_CUES` near the match) with **no prospective-offer framing** (`OFFER_CUES` absent) — a factual reference, not a rate offer. Only the AGENT `rate offer` lane row carries it; it reuses the exact shared cue regexes from the rate-claims scanner so the two scanners agree. M7 `checkCompliance` does not implement this kind. |

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

### v0.5.0 — lane checker own-rate escape (lead's existing rate is not an offer)

Ports the v0.4.0 rate-claims **lead-owned-rate** carve-out into the **lane**
checker so the two scanners agree (Kelly ruling 2026-06-03: *"you should be able
to mention the rate of the lead"*). A shadow-replay showed `scanLaneViolations(text,
"AGENT")` was flagging the lead's OWN existing rate as an MLO-lane "rate offer"
(e.g. *"your current rate is sitting at 2.88%"*, *"you're sitting on a 2.94%
rate"*) — factual references, not offers.

- The AGENT **`rate offer`** lane row gains an **`own-rate`** allowed-context: a
  possessive *"your rate is …"* match is excused when the surrounding window
  references the lead's own existing rate (`OWN_RATE_CUES`) with no prospective-
  offer framing (`OFFER_CUES`). A real offer **still flags** — *"your rate will be
  5.5%"*, *"your new rate could be 5.5%"*, *"I can offer you a rate of …"*.
- **Single source of truth:** the lane checker imports the **exact** `OWN_RATE_CUES`
  / `OFFER_CUES` regexes from `src/rate-claims/scan.ts` (Python: `lane_checker.py`
  imports them from `rate_claims.py`) — no duplicated/divergent list. `OFFER_CUES`
  also gained `will be` / `would be` (a future-tense quote is a prospective offer),
  so **both** scanners now flag *"your rate will be 5.5%"*.
- Other lane rows and the MLO lane are **unchanged**; DUAL still returns `[]`;
  default severity stays **WARNING / armed=false** (no arming change).

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

## Lane checker — role-aware "stay in your lane" rules (DRAFT — awaiting Kelly's approval)

> **STATUS: DRAFT. Default severity is `WARNING` (warn-only). Nothing here is
> armed to HARD_BLOCK. No existing M7 gate calls the lane checker — wiring it in
> is an explicit, opt-in step taken only after Kelly approves the phrase list
> below.** To arm later, a consumer passes `severityFloor: "HARD_BLOCK"` to
> `scanLaneViolations` — the SoT default stays warn-only.

A nurture email is sent on behalf of **either** a real-estate **AGENT** (state RE
license) **or** a mortgage **loan officer (MLO** — NMLS / SAFE Act). Regulators
object when one acts in the other's lane: an agent must not originate, quote, or
approve a loan; an MLO must not solicit a listing or act as the buyer's/seller's
agent. The lane checker flags **cross-lane** language so it can be warned on (and,
once approved, blocked) before the copy goes out.

```ts
import { scanLaneViolations } from "@rello-platform/compliance-words";

scanLaneViolations("Lock your rate today!", "AGENT");
// → [{ token: "lock your rate", lane: "AGENT_LANE_VIOLATION", severity: "WARNING", ... }]

scanLaneViolations("List your home with me!", "MLO");
// → [{ token: "list your home with me", lane: "MLO_LANE_VIOLATION", severity: "WARNING", ... }]

scanLaneViolations("List your home with me!", "AGENT"); // → []  (in the agent's lane)
```

`role ∈ { "AGENT", "MLO", "DUAL" }`. It reuses the **same context model** as M7
(negation / compound / disclaimer-banner excusal) over the **same shared match
engine**, so it is conservative against false positives in exactly the same way:
**only an offer, a solicitation, or in-lane advice in the WRONG lane is flagged.**
General market context that BOTH roles may write is never flagged.

### DUAL role

A genuinely dual-licensed sender (holds **both** an RE license **and** an active
NMLS registration) may lawfully speak in either lane, so `role: "DUAL"` **skips
the lane checks** and returns `[]`. Applying both lanes to a dual-licensee would
flag every legitimate sentence. The trade-off (a dual-licensee can still write
copy that fails M7 or RESPA rules) is handled by the **independent** M7
`checkCompliance` gate, which a consumer runs regardless of role. **Default a
sender to their single license (AGENT or MLO); use DUAL only when dual licensure
is verified**, so the safe default keeps lane enforcement ON. (An unrecognized
role is fail-safe-strict — it applies BOTH lanes.)

---

### Banned phrases per lane — for line-by-line approval

Every row below is matched as a **phrase collocation** (the offer/solicitation
framing must be present — a bare topical noun is not enough), is excused by a
**negation** ("I am *not* your agent…") or a **caller-marked disclaimer/referral
block**, and defaults to **WARNING**. Each row also notes what it **deliberately
does NOT catch** (the false-positive guard).

#### AGENT lane — MLO-only language, **forbidden for an agent**

| # | Rule (`token`) | Banned phrasings (any of) | Deliberately NOT caught |
|---|---|---|---|
| A1 | **rate offer** | "your rate is / will be / would be", "your interest rate is / will be", "we/I can offer you a rate (of)", "I can get you a rate", "we'll / I'll give you a rate", "a special / an exclusive rate of" | General market rates ("30-year rates are around 6% per Freddie Mac", "rates have come down", "ask your loan officer about current rates"). **OWN-RATE escape (v0.5.0, Kelly ruling 2026-06-03):** a factual reference to the lead's OWN existing rate ("your current rate is 2.88%", "your rate is still one of the best", "you're sitting on a 2.94% rate", "your 6.5% rate alert") — own-rate cue near the match, no prospective-offer cue. Mirrors the rate-claims `scanRegZ` carve-out (shared `OWN_RATE_CUES`/`OFFER_CUES`) so the two scanners agree; a prospective offer under "your" STILL flags ("your rate will be 5.5%", "I can offer you a rate of …"). |
| A2 | **you qualify for** | "you (may / 'll) qualify for a loan / mortgage / financing / a rate (of) / a loan amount / up to / a lower rate", "you pre-qualify for a loan" | Non-loan eligibility ("you qualify for a property-tax exemption", "homes that qualify for this program"). |
| A3 | **approved for a loan** | "you're / you are approved (or pre-approved) for a loan / mortgage", "you're / you are pre-approved", "I/we can get you approved", "you've been approved for financing" | Non-loan approvals ("your offer was approved by the seller", "the HOA approved your application", "HUD-approved counselor"). |
| A4 | **lock your rate** | "lock (in) your rate / interest rate", "let's / we can / I can lock your rate", "lock your rate today", "lock in a low / great rate" | Unrelated "lock" ("lock the front door", "lock box code", builder "price lock"). |
| A5 | **refinance with me** | "refinance with me / us", "I/we can refinance you / your …", "let me / let us refinance", "refinance your loan / mortgage with me / us" | Educational refi talk ("refinancing can lower your payment", "ask your loan officer about a refinance"). |
| A6 | **apply for a loan with me** | "apply for a loan / mortgage with me / us", "apply for your loan / mortgage with me", "start / complete your loan / mortgage application with me / us", "I/we can take your loan application" | Steering TO the MLO ("apply for a loan with your loan officer", bare "you'll need to apply for a loan"). |
| A7 | **recommend a loan product** | "I recommend a/an FHA / VA / USDA / conventional / jumbo / fixed-rate / adjustable-rate loan or mortgage / ARM / HELOC / home-equity loan / reverse mortgage", "you should get a/an …", "the right / best loan for you is" | Naming loan types educationally without recommending one ("FHA, VA, and conventional loans are options your loan officer can explain"). |
| A8 | **APR trigger term (Reg Z)** | "your APR / A.P.R. is / will be", "your (estimated) monthly payment is / will be", "rate(s) / APR / payment(s) as low as" | General payment illustrations; APR in a marked disclaimer. **Limitation:** keys on offer-framing words, NOT on parsing a numeric `%`/`$` figure — pair with a Reg-Z numeric scan for strict trigger-term detection. |

#### MLO lane — agent-only language, **forbidden for an MLO**

| # | Rule (`token`) | Banned phrasings (any of) | Deliberately NOT caught |
|---|---|---|---|
| M1 | **list your home with me** | "list your home / house / property with me / us", "list with me / us", "I/we can list your home", "I'll list your home", "let me list your home", "ready to list your home" | Ordinary "list" ("a checklist for closing", "the list of documents", "your listing agent can help"). |
| M2 | **I'll sell your home** | "I'll / I will / I can sell your home / house", "we'll / we will / we can sell your home", "let me sell your home / house", "sell your home / house for you", "I'll / I can get your home sold" | Market education ("homes are selling quickly", "when you sell your home, the proceeds can pay off your loan"). |
| M3 | **I'm your real estate agent** | "I'm / I am your real estate agent / Realtor / listing agent / agent", "as your real estate agent / Realtor / listing agent / buyer's agent", "I'll / I will be your real estate agent" | Naming the OTHER professional ("your real estate agent can help", "I'm your loan officer, not your agent"). |
| M4 | **let me show you homes** | "let me / I can / we can / I'll show you homes / houses / properties", "schedule / book a showing with me / us", "I can schedule a showing", "let's tour some homes", "I can take you to see homes" | Education ("when you're ready to see homes, your agent can set up showings", "open houses are a great way to see homes"). |
| M5 | **my listings** | "my listings", "my latest / new / featured / current listings", "check out / view / see / browse my listings", "my just-listed home(s)", "my new / latest / featured listing", "my listing agreement", "homes I have listed" | The bare singular "my listing of …" (a list of items), "listings on the MLS" (no possessive), "your agent's listings". |
| M6 | **free CMA to list** | "free CMA / comparative market analysis", "get / request your free CMA", "complimentary CMA", "free home valuation to list", "what's your home worth (to) list", "I'll / I can / let me prepare a CMA", "I'll run a CMA for you", "free market analysis to sell your home" | A neutral CMA reference ("your agent can prepare a CMA", "a CMA estimates market value") — the bare phrase "comparative market analysis" alone is not a form. |
| M7L | **represent you in the purchase or sale** | "represent you in the purchase / sale / buying / selling", "represent you in your home purchase / sale", "represent you as your agent", "I/we can / I'll / let me represent you in the purchase / sale" | Loan-side help ("represent your loan file to the underwriter"), naming the agent ("your agent represents you in the purchase"). |

> **Approval workflow:** review each row above. The phrase lists and
> false-positive guards live verbatim in `src/lanes/index.ts` (`rationale` field
> per row) and are emitted to `dist/compliance-words-keyset.json` (`laneEntries`).
> To **change** a row, edit the registry and rebuild. To **arm** a row to block,
> a consumer raises the severity floor (the SoT keeps the WARNING default).

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

The same keyset additionally carries the **lane** vocabulary + config
(`laneEntries`, `laneConfig`) so the lane checker is also cross-language. A
reference Python re-implementation ships in `python/lane_checker.py`
(`scan_lane_violations`), and `python/test_lane_parity.py` runs a shared corpus
through **both** the TS and Python scanners and asserts verdict-for-verdict
parity — the same SoT discipline the Report-Engine M7 checker follows. (A
v0.1.2-era consumer that only reads `entries` is unaffected — the lane block is
purely additive.)

## Develop

```bash
npm install
npm run build      # tsup → dist/ (ESM + CJS + d.ts) + emits the keyset (M7 + lanes)
npm test           # build + node --test (M7 + lane suites) + TS<->Python lane parity
npm run typecheck
npm run test:parity   # just the TS<->Python lane parity run (needs python3 on PATH)
```

`dist/` is committed; rebuild and commit it whenever `src/` changes. `npm test`
runs the Python lane-parity suite when `python3`/`python` is on PATH; on a
Node-only runner it prints a notice and skips that layer (the TS suite still
proves the TS side).

## Provenance

Built from `RELLO TO BE BUILT/_SPEC-M7-COMPLIANCE-WORDS-SOT.md` (Phase 1). The
human-readable policy lives in
`App Development Docs for Rello Platform/10-COMMUNICATION-GUARDRAILS.md`
§ Prohibited Language (M7), which points here as the machine SoT.
