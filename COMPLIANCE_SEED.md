# COMPLIANCE_SEED.md

Verified seed facts for the compliance expansion (Task 2) and the state AI
transparency tab (Task 3). Verified June 2026. Codex must re-confirm every URL
resolves and every date is current before writing it into the data, and must set
`lastVerified` to the date of that confirmation. Do not copy a date from this
file without re-checking the source.

This file is a starting map, not the final data. It exists so the agent does not
guess names, IDs, or relationships.

## Control-family backbone (already in repo, keep as the spine)

- NIST SP 800-53 Revision 5 is the control catalog the matrix already maps to
  via `controlLens` (11 families currently present). Keep this as the backbone
  that the other programs crosswalk to.
  - Catalog: https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
  - Verify the current release string against csrc.nist.gov rather than trusting
    the value in the file.

## Compliance programs to add (Task 2)

Each program below becomes one entry in the new `complianceFrameworks` array.
Capture: official name, short id, issuing body, what it governs, who it applies
to, its relationship to NIST 800-53 (most US gov programs build on it), official
URL, and a one-line historical note where the name or status changed.

1. FedRAMP (Federal Risk and Authorization Management Program)
   - Federal cloud authorization program. Baselines build on NIST 800-53.
   - https://www.fedramp.gov/
   - Note: FedRAMP has been modernizing its authorization process. Confirm the
     current program structure on fedramp.gov before describing it.

2. GovRAMP (formerly StateRAMP)
   - State, local, tribal, and education cloud authorization program.
   - https://govramp.org/
   - Historical fact, verified: StateRAMP announced its rebrand to GovRAMP on
     February 14, 2025. The legal entity name remains "StateRAMP," operating as
     (dba) "GovRAMP." Existing authorizations and memberships carried over
     unchanged. Record current name as GovRAMP, with StateRAMP as the prior and
     legal name. The matrix's existing "GovRAMP" usage is correct; add the
     StateRAMP historical reference.

3. CJIS Security Policy (FBI Criminal Justice Information Services)
   - Security requirements for criminal justice information.
   - https://www.fbi.gov/services/cjis/cjis-security-policy-resource-center
   - Note: the CJIS Security Policy is versioned and revised periodically.
     Capture and verify the current version number from the FBI page.

4. HIPAA Security Rule (HHS)
   - Safeguards for electronic protected health information.
   - https://www.hhs.gov/hipaa/for-professionals/security/index.html

5. FERPA (US Dept. of Education)
   - Privacy of student education records.
   - https://studentprivacy.ed.gov/
   - https://www2.ed.gov/policy/gen/guid/fpco/ferpa/index.html

6. FIPS 140-3 (NIST Cryptographic Module Validation Program)
   - Validation standard for cryptographic modules. FIPS 140-2 is being phased
     out in favor of 140-3. Capture both, with 140-2 marked as superseded.
   - https://csrc.nist.gov/projects/cryptographic-module-validation-program

## NIST AI frameworks to add (Task 2, AI compliance section)

These are the "few new AI" items. They are governance frameworks, not pass/fail
certifications. Model them as their own group inside `complianceFrameworks`
with a flag distinguishing voluntary frameworks from authorization programs.

1. NIST AI RMF 1.0 (NIST AI 100-1), released January 2023. Four functions:
   Govern, Map, Measure, Manage.
   - https://www.nist.gov/itl/ai-risk-management-framework
   - https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf

2. NIST AI 600-1, Generative AI Profile, released July 26, 2024. Defines 12 GAI
   risk categories mapped to the four RMF functions.
   - https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf

3. NIST IR 8596, Cybersecurity Framework Profile for AI ("Cyber AI Profile").
   Preliminary draft released December 2025. Bridges CSF 2.0 and the AI RMF.
   - Verify exact URL on csrc.nist.gov. Mark status as Draft.

4. SP 800-53 Control Overlays for Securing AI Systems (COSAiS). In development,
   initial public draft expected 2026. This is the one that directly extends the
   matrix's existing 800-53 backbone to AI, so flag it for follow-up.
   - Verify on csrc.nist.gov. Mark status as In development / Draft.

Optional context, do not assert as a framework: NIST released a concept note for
an AI RMF Profile on Trustworthy AI in Critical Infrastructure in April 2026.

## State AI transparency mandates (Task 3), Indiana first

Interpretation (confirmed): this tab is the public record of each state's own AI
governance, that is, what a state government has publicly published about how it
uses AI and what it must disclose. Entries are binding or published state
instruments: executive orders, statutes, or official state AI policies.

Source rule for this tab, strict: the `url` for every populated entry must be on
that state's own official government domain (a `.gov` or the state's official
domain, for example `in.gov`). Third-party trackers, law-firm summaries, news
articles, and advocacy sites are not acceptable as the source, even when
accurate. If only a third party reports a mandate and you cannot find it on the
state's official site, leave the entry `Unknown` and note that the official
record was not located. The point of the tab is the official public record, not
a secondhand summary of it.

The wider context, verified, that the tab should acknowledge: on December 11,
2025 the federal government issued Executive Order 14365, "Ensuring a National
Policy Framework for Artificial Intelligence" (90 FR 58499), which pushes toward
preempting conflicting state AI laws. The state landscape is therefore in flux.
The tab should timestamp every entry and state that status is volatile.

Indiana seed (verify each before publishing):
- State of Indiana Policy: Artificial Intelligence, Version 1.1 (December 2024),
  published by the Management Performance Hub Chief Data Officer.
  https://www.in.gov/mph/cdo/files/State-of-Indiana-Artificial-Intelligence-Policy.pdf
- Indiana MPH Chief Data Officer (AI governance home):
  https://www.in.gov/mph/cdo/
- Indiana Office of Technology (state IT authority): https://www.in.gov/iot/
- Background: a prior Indiana executive order established a state AI task force.
  Confirm the current order number and status on in.gov before citing it.

Scaffold all 50 states plus DC as rows, each with status `Unknown` and empty
source fields, so the tab is complete in shape and honest about coverage. Only
Indiana is populated at launch. Other states get filled through the same
proposer-then-human-approve flow as the matrix.

## Cloud government-vs-commercial parity sources (Task 5, filling parityLag)

Use these official pages to assert `parityLag` and `govAvailability`. These are
the primary sources for commercial-vs-government feature gaps.

- AWS GovCloud (US) User Guide, including how GovCloud differs:
  https://docs.aws.amazon.com/govcloud-us/latest/UserGuide/
  Regional service list: https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/
- Azure Government docs and "compare Azure Government and global Azure":
  https://learn.microsoft.com/en-us/azure/azure-government/
  Products by region: https://azure.microsoft.com/en-us/explore/global-infrastructure/products-by-region/
- Google Cloud Assured Workloads (government controls) and locations:
  https://cloud.google.com/assured-workloads/docs
  https://cloud.google.com/about/locations
- OCI government regions and FedRAMP realm:
  https://docs.oracle.com/en-us/iaas/Content/General/Concepts/govfedramp.htm
