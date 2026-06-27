# CloudIntelMatrix TODO

Last updated: 2026-06-27

This is the working roadmap for the next small pull requests. Keep factual data changes proposal-only unless a human has approved applying proposals through `scripts/apply_proposals.py`.

## Current State

- Repo status at update time: no open pull requests and no open GitHub issues.
- Latest GitHub Actions status at update time: Verify matrix data and GitHub Pages deploy succeeded on `main`.
- Matrix data version: `3.16.6`.
- Matrix last verified date: `2026-06-24`.
- Coverage: 30 capability rows, 4 providers, 120 provider cells.
- Remaining unknowns: 97 `parityLag` cells and 26 `govAvailability` cells.
- Transparency coverage: 10 populated state/DC rows out of 51.

## Near-Term PRs

1. Start the next Task 5 proposal batch for AI / ML.
   - Use proposal files only.
   - Do not edit `data/matrix.json` directly.
   - Focus on official provider government and regulated-environment sources.
   - Keep `parityLag` as `Unknown` unless an official source establishes a commercial-to-regulated feature difference or equivalence.

2. Expand state AI transparency in small official-source batches.
   - Add only state-government or official state-domain sources.
   - Keep unverified states as `Unknown`.
   - Prefer 3 to 5 states per PR so review stays practical.

3. Add a provider-neutral realm-class plan before changing data shape.
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

