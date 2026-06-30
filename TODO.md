# CloudIntelMatrix TODO

Last updated: 2026-06-30

This is the working roadmap for the next small pull requests. Keep factual data changes proposal-only unless a human has approved applying proposals through `scripts/apply_proposals.py`.

## Current State

- Repo status at update time: no open pull requests and no open GitHub issues.
- Latest GitHub Actions status at update time: Verify matrix data and GitHub Pages deploy succeeded on `main`.
- Matrix data version: `3.16.6`.
- Matrix last verified date: `2026-06-24`.
- Coverage: 30 capability rows, 4 providers, 120 provider cells.
- Remaining unknowns: 97 `parityLag` cells and 26 `govAvailability` cells.
- Transparency coverage: 13 populated state/DC rows out of 51.

## Near-Term PRs

1. Start the next Task 5 proposal batch for AI / ML.
   - Initial proposal batch landed in `data/proposals/ai-ml-regulated-availability-2026-06-27.json`.
   - Use proposal files only.
   - Do not edit `data/matrix.json` directly.
   - Focus on official provider government and regulated-environment sources.
   - Keep `parityLag` as `Unknown` unless an official source establishes a commercial-to-regulated feature difference or equivalence.

2. Expand state AI transparency in small official-source batches.
   - Initial follow-up batch populated Massachusetts, New Jersey, and Oregon.
   - Add only state-government or official state-domain sources.
   - Keep unverified states as `Unknown`.
   - Prefer 3 to 5 states per PR so review stays practical.

3. Add a provider-neutral realm-class plan before changing data shape.
   - Planning note: `docs/realm-class-plan.md`.
   - Candidate values: `commercial`, `us-gov`, `eu-sovereign`, `other-sovereign`.
   - Treat AWS European Sovereign Cloud, Azure Government, GCP Assured Workloads, OCI Government realms, and similar environments evenly.
   - Start with a design/schema proposal before migrating matrix records.

4. Prepare the next design review pass.
   - Wait for the external design agent findings.
   - It is acceptable to reuse the design stylesheet colors if they improve clarity.
   - Keep theme tokens and CSS variables intact so light/dark mode remains readable.
   - Keep the app data-backed through `data/*.json` and `src/viewModels.mjs`.

5. Improve update monitoring where official sources allow it.
   - Keep Azure MRC update monitoring healthy.
   - Identify a reliable official OCI release feed or API before automating OCI updates.
   - Keep scheduled link-check output actionable and avoid recurring non-actionable pricing-page noise.
   - Operational status source links now live in `data/status.json`; future live-status or uptime snapshots should use scheduled ingestion, not runtime browser fetches.

6. Plan the next schema-depth pass from the v3.13 work order.
   - Treat this as a design/schema PR before any matrix data migration.
   - Candidate optional provider fields: `parityDetail`, `constraints`, `previewTerms`, `costModel`, `region`, `eduUrl`, and `fedrampLevel`.
   - Keep `formerNames` as already implemented provider metadata.
   - Reuse the existing `status` enum for maturity unless a real product need proves a separate field is cleaner.
   - Update `data/schema.json`, `scripts/verify.py`, `scripts/generate_xlsx.py`, `src/App.jsx`, and proposal validation together if new factual provider fields are added.

7. Add a provider-neutral PQC readiness plan before changing matrix data.
   - Scope PQC to existing Security & Compliance / Identity decision rows, not a new top-level category.
   - Candidate optional provider field: `pqcReadiness` with KEM, signature, TLS, private CA, status, milestone date, FIPS endpoint parity, and official source.
   - Use official standards and provider documentation only: NIST FIPS 203/204/205, provider PQC docs, and documented CNSA 2.0 milestone dates.
   - Keep Azure and OCI values `Unknown` unless official Microsoft or Oracle sources support stronger claims.
   - Treat quantum-compute services as experimental timeline/context items, not decision-grade regulated capability rows.

8. Clean up the remaining CodeQL workflow annotation.
   - `codeql.yml` uses `github/codeql-action@v4`, but still uses `actions/checkout@v4`.
   - Other workflows already use `actions/checkout@v6`; update CodeQL checkout in a tiny workflow-only PR to remove the Node 20 forced-runtime annotation.

## Highest-Value Unknown Areas

Current unknown gov/parity review pressure by category:

| Category | Unknown gov/parity cells |
|---|---:|
| AI / ML | 19 |
| Security & Compliance | 13 |
| Networking | 11 |
| Core Infrastructure | 9 |
| Integration & Messaging | 8 |
| Developer Platform | 7 |
| Storage | 6 |
| Hybrid / Edge | 6 |

## Guardrails

- Official primary sources only.
- Unknown is acceptable when public evidence does not support a stronger claim.
- Factual matrix changes must go through proposal files first.
- Every PR should pass:
  - `python scripts/verify.py`
  - `npm run verify:view-model`
  - `npm ci`
  - `npm run build`
  - `python scripts/generate_xlsx.py`

