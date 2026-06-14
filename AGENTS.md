# AGENTS.md

Durable house rules for any AI agent (Codex, Claude, etc.) working in this repo.
Read this before touching anything. These rules outrank any single task prompt.

## What this project is

CloudIntelMatrix is a fact-first, provider-agnostic capability matrix for AWS,
Azure, GCP, and OCI, with an enterprise and government lens. It is a static
React + Vite site deployed to GitHub Pages (and Cloudflare). The data is the
product. The UI only renders `data/matrix.json` and its sibling data files.

## The one rule that matters most

Never invent a fact. Every asserted value must trace to an official primary
source (the cloud provider's own docs, or the standards body's own publication).
If no official source asserts a value, the value stays `Unknown` and the reason
goes in `sourceNotes`. "Unknown" is a correct, honest answer here. A wrong
"Full" or a guessed "Minor" is a defect, not progress.

Official primary sources only. Acceptable:
- Provider docs: docs.aws.amazon.com, learn.microsoft.com, cloud.google.com/docs, docs.oracle.com
- Provider government docs: AWS GovCloud (US) User Guide, Azure Government docs, GCP Assured Workloads docs, OCI government realm docs
- Standards bodies: csrc.nist.gov, nist.gov, fedramp.gov, govramp.org, fbi.gov CJIS, hhs.gov HIPAA, ed.gov FERPA
Not acceptable as the basis for a value: blogs, vendor marketing pages, forum
posts, model memory, or another aggregator. They may point you toward a primary
source, but the citation must be the primary source.

## Proposer, not editor

An agent may not change a factual value in `data/matrix.json` directly.
Factual changes (`status`, `govAvailability`, `parityLag`, `govVariant`, and any
URL) go through a proposal file first (see CODEX_TASKS.md, Task 4). A human
reviews and merges. You may edit non-fact scaffolding directly: UI code, export
code, schema additions, build scripts, docs.

## Always, on every change

1. Run `python scripts/verify.py` and make it pass. If you add link checks, run
   them too. Do not weaken `verify.py` to make a change pass.
2. Keep `data/schema.json` and `data/matrix.json` in agreement. If you add a
   field, update the schema, the validator in `scripts/verify.py`, the XLSX
   generator in `scripts/generate_xlsx.py`, and the UI in `src/App.jsx`.
3. Run `npm run build` and confirm it succeeds before opening a PR.
4. When you assert or re-verify a fact, set that record's `lastVerified` to the
   date you confirmed it against the source (ISO `YYYY-MM-DD`).
5. Add a dated entry to `data/CHANGELOG.md`.
6. Bump `_meta.version` (semver) and `_meta.last_verified` when matrix data
   changes.

## Scope discipline

- One task per pull request. The tasks in CODEX_TASKS.md are independent on
  purpose. Do not bundle the export work with the compliance work.
- Do not restructure existing fields or rename enums without an explicit task
  saying so. Additive changes are strongly preferred over breaking changes.
- Do not add runtime dependencies to the site without noting why in the PR. This
  is a static site with no backend. Prefer client-side, dependency-light export
  code. Server-side generation stays in the Python build scripts.
- Do not introduce telemetry, external API calls at runtime, or anything that
  phones home. The site must work fully offline once loaded.

## Style

- Plain language. No em dashes. No filler ("delve", "robust", "seamless",
  "in today's landscape"). Write like a careful engineer leaving a note.
- Match the existing code style in `src/App.jsx` and the script files. Read them
  before writing new code.

## Validation commands (run these, do not skip)

```bash
python scripts/verify.py          # schema + data integrity
python scripts/verify.py --links  # optional, checks public links resolve
npm ci && npm run build           # confirm the site builds
python scripts/generate_xlsx.py   # confirm the export build still runs
```
