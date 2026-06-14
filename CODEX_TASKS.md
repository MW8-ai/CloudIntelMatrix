# CODEX_TASKS.md

Work brief for Codex on MW8-ai/CloudIntelMatrix. Read AGENTS.md first, then
COMPLIANCE_SEED.md. Do one task per pull request. Each task lists the files to
touch, the acceptance criteria, and the validation commands. Do not start a task
until the previous PR is merged unless told the tasks are parallel-safe.

Current state you are starting from (do not re-derive, but do confirm):
- `data/matrix.json`, schema `capability-v1`, 30 capabilities x 4 providers.
- `controlLens` holds NIST 800-53 R5 with 11 control families.
- `src/App.jsx` has a `mode` state: matrix, patterns, controls, history, diff,
  gov, ai. Tabs render from there.
- Exports today: a single static XLSX link near the bottom of `App.jsx`. There
  is `scripts/generate_xlsx.py` (openpyxl) and `scripts/verify.py` (validator).
- All `parityLag` values are `Unknown`. Many `govAvailability` are `Unknown`.

---

## Kickoff prompt (paste this into Codex to start)

> You are working in the CloudIntelMatrix repo. Read AGENTS.md and
> COMPLIANCE_SEED.md fully before writing code. Then complete Task 1 from
> CODEX_TASKS.md only. Open a single pull request for it. Before the PR: run
> `python scripts/verify.py`, run `npm ci && npm run build`, and run
> `python scripts/generate_xlsx.py`, and confirm all three succeed. In the PR
> description, list exactly which files you changed and which acceptance
> criteria you met. Do not change any factual value in data/matrix.json. Do not
> start Task 2. Stop and ask me if any acceptance criterion is unclear or if a
> change would require renaming an existing field or enum.

Reuse that prompt for each later task by changing the task number.

---

## Task 1: Per-view exports (CSV, XLSX, PDF). Parallel-safe.

Goal: every data view in the app can be exported as a flat spreadsheet-style
list, not just the combined matrix. A user on any tab can download what they see
as CSV, XLSX, and PDF.

Scope:
- Add an export control (a small toolbar with CSV / XLSX / PDF buttons) that is
  present on each data-bearing view: matrix, controls/compliance, gov, ai,
  history, and the new transparency view once it exists.
- Export the currently filtered and visible rows, respecting active provider
  filters, category filter, tier, and search. What you see is what you export.
- Flatten nested provider data into columns. For the matrix view, one row per
  capability-provider pair with columns: capability, category, tags,
  aiClassification, provider, service, status, govAvailability, parityLag,
  govVariant, docsUrl, govDocsUrl, complianceUrl, pricingUrl, lastVerified,
  sourceNotes. Keep a separate one-row-per-capability "wide" option if simple to
  add, but the flat long form is the required default because the user wants a
  quick spreadsheet list.
- CSV: generate client-side, UTF-8 with BOM so Excel opens it cleanly. Quote
  fields containing commas, quotes, or newlines.
- XLSX: client-side via SheetJS (xlsx). One sheet per view, frozen header row,
  auto-width-ish columns. Keep the existing server-side combined XLSX too.
- PDF: a clean tabular PDF of the visible rows. Prefer a print-stylesheet
  approach (a `@media print` layout plus a "Print / Save as PDF" button) to
  avoid a heavy dependency. If a generated PDF is required instead, use
  jsPDF + autotable, landscape, repeating header row. State which you chose and
  why in the PR.
- Filenames: `cloudintelmatrix-<view>-<YYYY-MM-DD>.<ext>`.
- Also extend `scripts/generate_xlsx.py` to additionally emit a CSV per view
  into `dist/` at build time, so static download links exist even without JS.

Files: `src/App.jsx` (and any small helper module you add under `src/`),
`scripts/generate_xlsx.py`, `package.json` (add `xlsx`, and `jspdf` +
`jspdf-autotable` only if you go the generated-PDF route).

Acceptance criteria:
- On each listed view, CSV, XLSX, and PDF download the visible, filtered rows.
- Column set matches the spec above for the matrix view.
- No factual data changed. No runtime network calls added.
- `npm run build` succeeds. `python scripts/generate_xlsx.py` succeeds and writes
  the per-view CSVs.

---

## Task 2: Expand the compliance lens. Depends on nothing, but review carefully.

Goal: grow the single NIST 800-53 control view into a broader compliance view
that lists NIST 800-53 alongside FedRAMP, GovRAMP (with the StateRAMP historical
note), CJIS, HIPAA, FERPA, FIPS 140-2/3, and the NIST AI frameworks, with
official sources and crosswalks to the 800-53 families already in the data.

Use COMPLIANCE_SEED.md for names, ids, dates, and official URLs. Re-verify each
URL and date against its primary source and set `lastVerified` accordingly.

Schema (additive, in `data/schema.json`):
- Keep `controlLens` as is (the 800-53 backbone).
- Add a top-level `complianceFrameworks` array. Each item:
  - `id` (short slug, e.g. `fedramp`, `govramp`, `cjis`, `hipaa-security`,
    `ferpa`, `fips-140-3`, `nist-ai-rmf`, `nist-ai-600-1`).
  - `name`, `issuer`, `kind` (enum: `authorization-program`, `regulation`,
    `validation-standard`, `voluntary-framework`).
  - `scope` (one or two sentences: what and who it applies to).
  - `status` (enum: `Active`, `Draft`, `In development`, `Superseded`).
  - `url` (official primary source).
  - `nistAlignment` (free text or array of 800-53 family ids it builds on, where
    an official crosswalk exists; otherwise empty with a note).
  - `historicalNote` (optional, e.g. the StateRAMP-to-GovRAMP rebrand).
  - `lastVerified`.
- Mirror this structure in the validator in `scripts/verify.py` and in
  `scripts/generate_xlsx.py` (a "Compliance" sheet).

UI (`src/App.jsx`):
- Rename the `controls` mode label to "Compliance" (keep the internal key or
  migrate it cleanly, your call, but do not break deep links if any exist), and
  render two sections: the existing 800-53 family lens, and a new table of the
  `complianceFrameworks` entries grouped by `kind` (authorization programs,
  regulations, AI frameworks, validation standards).
- Each framework row links to its official source and shows status and the
  StateRAMP/GovRAMP note where relevant.

Guardrails:
- These are planning and reference aids. Carry forward the existing scope
  disclaimer language from `controlLens.scopeNote`: this is architecture
  planning help, not an applicability or authorization determination.
- Do not assert that any cloud service "is FedRAMP authorized" or similar in
  this task. That is per-service fact work that belongs in Task 5 with citations.

Acceptance criteria:
- `complianceFrameworks` exists in schema, data, validator, XLSX, and UI.
- Every entry has an official `url` that resolves and a `lastVerified` date set
  to when you confirmed it.
- GovRAMP entry records the StateRAMP rebrand as a historical note.
- NIST AI RMF, 600-1, and the draft AI items appear with correct `status`.
- `python scripts/verify.py` and `npm run build` pass.

---

## Task 3: State AI transparency mandate tab. Indiana first.

Goal: a new tab that is the public record of each state's own AI governance,
what each state government has officially published about how it uses AI and what
it must disclose. Scaffold all 50 states plus DC, with Indiana populated at
launch.

Read the interpretation note in COMPLIANCE_SEED.md. Strict source rule: every
populated entry's `url` must be on that state's own official government domain
(`.gov` or the state's official domain). No third-party trackers, law-firm
posts, or news as the source. If you cannot find the instrument on the state's
official site, the entry stays `Unknown` with a note that the official record was
not located.

Data: add `data/transparency.json` (own file, like `history.json`). Structure:
- `_meta` with `description` and `last_verified`.
- `mandates` array, one entry per state instrument:
  - `state` (two-letter), `stateName`, `instrument` (e.g. "Executive Order",
    "Statute", "State policy"), `title`, `citation`, `status`
    (enum: `Active`, `Proposed`, `Repealed`, `None on record`, `Unknown`),
    `summary` (plain language, what it requires and what must be disclosed),
    `url` (official source), `lastVerified`.
- Scaffold all 50 states + DC. States with nothing confirmed get
  `status: "Unknown"` and empty `url`. Only Indiana is filled at launch, from
  the seed sources, after you verify them.

UI: add a `transparency` mode and tab. Render a sortable, filterable table
(filter by status, search by state). Include a visible banner noting that the
federal-versus-state AI legal picture is in flux as of the data date (reference
the December 2025 federal preemption executive order from the seed file as
context, with its official citation), so readers treat entries as point-in-time.

Validator and XLSX: add `transparency.json` validation to `scripts/verify.py`
and a "Transparency" sheet to `scripts/generate_xlsx.py`.

Acceptance criteria:
- New tab renders; all 50 states + DC present; Indiana populated from its
  official in.gov sources, with dates; everything else honestly `Unknown`.
- Every populated entry's `url` is on an official state government domain.
  Extend `verify.py` to flag any populated transparency entry whose `url` is not
  on a `.gov` or recognized official state domain.
- Volatility banner present with the federal EO citation.
- verify.py and build pass. Export (Task 1) includes this view if Task 1 merged.

---

## Task 4: Fact-verification agent as proposer. Do this before Task 5.

Goal: a repeatable agent workflow that proposes values for `Unknown` and stale
fields with official citations, writes them to a review file, and never edits
`matrix.json` directly. A human merges.

Build:
- `scripts/propose_facts.py`. Inputs: the matrix and a target field set
  (default: `parityLag`, `govAvailability`, plus link freshness). For each
  target record it records a proposal object:
  `{ capability, provider, field, currentValue, proposedValue, sourceUrl,
     sourceQuote (short, under 15 words), rationale, proposedOn }`.
  Output to `data/proposals/<field>-<YYYY-MM-DD>.json`. The script itself does
  not fetch and decide; it produces the worklist and structure. The agent (you,
  in a run) fills proposals using the official sources in COMPLIANCE_SEED.md and
  the provider gov-vs-commercial docs, one source per claim.
- A human-merge helper `scripts/apply_proposals.py` that, given an approved
  proposals file, writes the values into `matrix.json`, sets `lastVerified`, and
  appends to `CHANGELOG.md`. It refuses to apply any proposal missing a
  `sourceUrl`.
- Extend `verify.py` to validate proposal files against this shape and to fail
  if any proposal lacks a source.
- Add a workflow `.github/workflows/propose-facts.yml` (scheduled, manual
  dispatch) that runs `propose_facts.py` and opens a PR with the worklist, or
  attaches it to the existing weekly review issue. Do not let it merge.

Guardrails: the agent may write proposals; it may not run `apply_proposals.py`
against `main`. Application is a human step. A proposal with no official source
is invalid and must be dropped, not guessed.

Acceptance criteria:
- Running `propose_facts.py` produces a structured proposals file.
- `apply_proposals.py` refuses sourceless proposals and, on a sample approved
  file, writes correct values, dates, and changelog entry.
- verify.py validates proposal shape. Workflow opens a PR/issue and never
  auto-merges. Build still passes.

---

## Task 5: Fill the Unknowns, in batches, through Task 4. Ongoing.

Goal: replace `Unknown` `parityLag` and `govAvailability` values with cited
ones, using the Task 4 proposer flow. Start with the highest-traffic
capabilities (Core Infrastructure, Identity & Access, AI / ML).

Method, per batch (keep batches to roughly 5 capabilities so review is easy):
- Generate the proposals worklist.
- For each capability-provider, consult the official gov-vs-commercial source in
  COMPLIANCE_SEED.md. Assign `parityLag` per the existing enum
  (None/Minor/Moderate/Significant) only when the official source supports it.
  If the source does not let you judge feature gap, leave `Unknown` and say why
  in `sourceNotes`. Do the same for `govAvailability`.
- Each proposal carries the official URL and a short quoted basis.
- Open a PR with the proposals file for human approval. After approval, the human
  runs `apply_proposals.py`.

Acceptance criteria:
- No value flips from `Unknown` without an official `sourceUrl` in its proposal.
- `sourceNotes` explains any value left as `Unknown`.
- `lastVerified` updated on every touched record. verify.py and build pass.

---

## Ordering and parallelism

- Task 1 is independent. It can run first or alongside others.
- Task 2 and Task 3 are independent of each other and of Task 1.
- Task 4 must land before Task 5.
- Keep each in its own PR. Do not combine.
