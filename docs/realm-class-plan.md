# Realm-Class Plan

Last updated: 2026-06-27

## Purpose

CloudIntelMatrix currently has one regulated-availability summary per
capability/provider cell:

- `govAvailability`
- `govVariant`
- `parityLag`
- `govDocsUrl`
- `sourceNotes`

That works for a quick matrix, but it compresses different deployment
environments into one value. A future data pass should separate the class of
regulated environment being evaluated so AWS GovCloud, Azure Government,
provider sovereign clouds, and control-package approaches can be compared
without creating provider-specific special cases.

This document began as a planning note. As of 2026-06-30, the schema allows
optional provider-level `region`, `realmClass`, and `lastVerified` fields as an
interim scaffold. Matrix facts still must be populated through proposal files
only, and the preferred future shape remains provider-level `regulatedRealms`
when the product needs multiple realms per provider/capability cell.

## Design Goals

- Keep the current matrix readable for quick comparison.
- Treat equivalent environment types evenly across AWS, Azure, GCP, and OCI.
- Avoid AWS-only, Azure-only, or OCI-only fields.
- Keep `Unknown` as a valid result when official sources do not support a
  stronger claim.
- Preserve the existing `govAvailability` and `parityLag` fields as summary
  rollups until the UI and exports can render realm detail cleanly.

## Candidate Realm Classes

The initial controlled vocabulary should stay small:

| Value | Meaning |
|---|---|
| `commercial` | Standard public commercial cloud environment. |
| `us-gov` | U.S. government or U.S. public-sector regulated environment. |
| `eu-sovereign` | European sovereign or EU-focused sovereign cloud environment. |
| `other-sovereign` | Other national, regional, or sector-specific sovereign environment. |

Important distinction: `realmClass` is not an authorization result, compliance
attestation, or feature-parity claim. It only names the type of environment
being evaluated.

## Data-Shape Options

### Option A: Add `realmClass` To Provider Records

Add one optional `realmClass` field to each provider record.

Pros:
- Minimal schema change.
- Easy to render as one chip in the current UI.

Cons:
- Not enough for providers with more than one regulated or sovereign offering.
- Forces one summary value to stand in for multiple environments.

Recommendation: use only as an interim scaffold for single-realm display.

### Option B: Add Provider-Level `regulatedRealms`

Add an optional array to each provider record:

```json
"regulatedRealms": [
  {
    "realmClass": "us-gov",
    "variant": "<official environment name>",
    "availability": "Unknown",
    "parityLag": "Unknown",
    "docsUrl": "<official primary source URL>",
    "lastVerified": "2026-06-27",
    "sourceNotes": "Official source did not establish service-specific availability."
  }
]
```

Pros:
- Can represent multiple realms for one provider and capability.
- Keeps facts close to the provider cell they describe.
- Allows the existing summary fields to remain as rollups.

Cons:
- Increases matrix size.
- Requires schema, validator, XLSX, export, and UI updates.

Recommendation: preferred future shape after a small schema proposal.

### Option C: Add A Separate `realms.json`

Create a separate source file that defines provider environment families, then
reference them from matrix records.

Pros:
- Avoids repeating environment metadata on every capability row.
- Good fit for provider-level facts such as launch status or official docs.

Cons:
- Still needs capability-level availability somewhere.
- Adds another join for validators, exports, and UI rendering.

Recommendation: useful as a companion later, not enough by itself.

## Proposed Migration Path

1. Add a schema proposal for optional provider `regulatedRealms`.
2. Update `scripts/verify.py` to validate realm entries without requiring them.
3. Update `scripts/generate_xlsx.py` and client exports with one row per
   provider/capability/realm when realm data exists.
4. Update the UI to show realm chips and add a realm filter in the government
   and matrix views.
5. Populate realm entries through proposal files only. Do not migrate all 120
   provider cells in one PR.
6. Keep current summary fields until the realm view is complete and reviewed.

## Rollup Rule

The current `govAvailability` value should remain the conservative summary of
the best-supported regulated environment for that provider/capability, not a
promise that every realm class has the same support.

Suggested rollup behavior:

- `Full`: all mapped components are officially available in the named summary
  environment.
- `Partial`: some mapped components or control-package contexts are supported.
- `Limited`: official source confirms availability and material limitations.
- `None`: official source confirms the mapped service is not available in the
  evaluated environment.
- `Unknown`: public official evidence does not support a stronger claim.

Realm-level entries should carry their own `availability` and `parityLag` so the
summary field can stay readable while deeper analysis remains available.

## Review Questions

- Should GCP Assured Workloads be modeled as a realm class, a control package,
  or both?
- Should EU sovereign cloud and country-specific sovereign environments share
  one `eu-sovereign` value, or should country-specific values be added later?
- Should `realmClass` be exposed as a visible filter in the Matrix tab or only
  in Gov / Parity at first?
- Should the summary `govVariant` remain a string, or should it become a
  generated label from the highest-confidence realm entry?

## Acceptance Criteria For The Future Schema PR

- No existing matrix values are renamed or removed.
- Realm fields are optional and additive.
- Validator rejects unsupported realm classes.
- XLSX and CSV exports include realm detail when present.
- UI remains readable when a provider has zero, one, or multiple realm entries.
- All realm facts use official primary sources and proposal review.
