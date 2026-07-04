# CloudIntelMatrix TODO

Last updated: 2026-07-04

This is the working roadmap for the next small pull requests. Keep factual data changes proposal-only unless a human has approved applying proposals through `scripts/apply_proposals.py`.

## Current State

- Repo status at update time: FedRAMP objects, PQC objects, and Government / Sovereign Cloud Offerings residency objects are applied; open PR/issue status should be checked in GitHub before planning new work.
- Latest GitHub Actions status at update time: Verify matrix data and GitHub Pages deploy succeeded on `main`.
- Matrix data version: `3.21.0`.
- Matrix last verified date: `2026-07-04`.
- Coverage: 30 capability rows, 4 providers, 120 provider cells.
- Remaining unknowns: 97 `parityLag` cells and 26 `govAvailability` cells.
- Transparency coverage: 13 populated state/DC rows out of 51.
- FedRAMP depth objects are applied across all 120 provider cells. PQC readiness objects are applied across 20 provider cells with source-tier policy enforcement. Residency objects are applied only to the Government / Sovereign Cloud Offerings row, with 10 offerings across AWS, Azure, GCP, and OCI.

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
   - AI lab watch source links now live in `data/ai_watch.json`; future model-release snapshots should use scheduled ingestion from documented official feeds, not runtime browser fetches.

6. Populate schema-depth fields through proposal review.
   - Optional provider scaffolding now covers `parityDetail`, `constraints`, `costModel`, nested `pqcReadiness`, nested `fedramp`, legacy `fedrampLevel`, and legacy `dodImpactLevel`.
   - FedRAMP object proposals from `data/proposals/fedramp-objects-2026-07-03.json` have been approved/applied where source-safe; remaining work items document review backlog.
   - Keep the existing `region` string and `realmClass` enum until a separate provider-neutral region model is designed.
   - Do not populate these fields directly in `data/matrix.json`; use official-source proposal files first.
   - Consider `previewTerms` and education-specific URLs only if a concrete sourced use case appears.

7. Maintain provider-neutral PQC readiness facts through proposals.
   - Scope PQC to existing Security & Compliance / Identity decision rows, not a new top-level category.
   - Use the optional `pqcReadiness` field for KEM, signature, TLS, VPN, status, milestone date, FIPS endpoint parity, and official source.
   - AWS/Azure/GCP/OCI PQC objects are applied across the five scoped Security & Compliance / Identity rows; roadmap claims may use only the official first-party blog sources enumerated in `data/SOURCE-POLICY.md` and are capped at Medium confidence when sourced that way.
   - Use official standards and provider documentation only: NIST FIPS 203/204/205, provider PQC docs, and documented CNSA 2.0 milestone dates.
   - Keep non-roadmap Azure and OCI values `Unknown` unless Tier 2 Microsoft or Oracle product documentation supports stronger claims.
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

