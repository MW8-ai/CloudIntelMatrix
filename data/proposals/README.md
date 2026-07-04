# Fact Proposals

Generated files in this directory are review worklists until they contain
entries under `proposals`.

Rules:

- Work items are not claims.
- Every proposal must cite an official primary `sourceUrl`.
- `sourceQuote` must stay short, under 15 words.
- Agents must not run `scripts/apply_proposals.py` against `main`.
- Human approval is represented by `_meta.approved: true` in the proposal file.
- Object-level proposals such as `fedramp` and `pqcReadiness` may include
  `workItems` for candidates that still need source review. Only entries under
  `proposals` are proposal-ready, and they still require human approval before
  apply.
