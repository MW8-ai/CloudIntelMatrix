# ☁️ Cloud Intelligence Matrix

<!-- repo-badges:start -->
[![Visibility](https://img.shields.io/badge/visibility-public-brightgreen)](https://github.com/MW8-ai/CloudIntelMatrix) [![GitHub last commit](https://img.shields.io/github/last-commit/MW8-ai/CloudIntelMatrix)](https://github.com/MW8-ai/CloudIntelMatrix/commits) [![GitHub repo size](https://img.shields.io/github/repo-size/MW8-ai/CloudIntelMatrix)](https://github.com/MW8-ai/CloudIntelMatrix) [![Maintained](https://img.shields.io/badge/maintained-yes-brightgreen)](https://github.com/MW8-ai/CloudIntelMatrix) [![License](https://img.shields.io/github/license/MW8-ai/CloudIntelMatrix)](https://github.com/MW8-ai/CloudIntelMatrix/blob/main/LICENSE)
<!-- repo-badges:end -->


> Enterprise and government cloud capability intelligence — AWS · Azure · GCP · OCI

**[Live →](https://mw8-ai.github.io/CloudIntelMatrix/)** &nbsp;|&nbsp; **[XLSX →](https://mw8-ai.github.io/CloudIntelMatrix/Cloud_Intelligence_Matrix.xlsx)** &nbsp;|&nbsp; **[Report a correction →](https://github.com/MW8-ai/CloudIntelMatrix/issues/new/choose)**

---

Roadmap: [TODO.md](TODO.md)

## What this is

A provider-neutral, fact-first reference for enterprise architects, platform engineers, government IT, and security teams making cloud decisions.

**Not** a "top cloud" ranking, affiliate content, or AI hype. **Yes** to operational reality, governance visibility, parity lag tracking, and compliance-aware architecture.

### Architecture framework lens

This guide maps comparison decisions against current provider-authored architecture and enterprise-foundation guidance, reviewed through 2026-05-26:

| Provider | Architecture framework | Enterprise foundation guidance |
|---|---|---|
| AWS | [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html) | [AWS Control Tower multi-account landing zone](https://docs.aws.amazon.com/controltower/latest/userguide/aws-multi-account-landing-zone.html) |
| Microsoft Azure | [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework) | [Azure Landing Zones](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/landing-zone/) |
| Google Cloud | [Google Cloud Well-Architected Framework](https://docs.cloud.google.com/architecture/framework) | [Enterprise foundations blueprint](https://docs.cloud.google.com/architecture/blueprints/security-foundations) |
| Oracle Cloud Infrastructure | [OCI Well-Architected Framework](https://docs.oracle.com/en/solutions/oci-best-practices/index.html) | [OCI Landing Zones in the Cloud Adoption Framework](https://docs.oracle.com/en-us/iaas/Content/cloud-adoption-framework/oci-landing-zones-overview.htm) |

Rows are decision aids, not claims that different provider products are identical. Compound portfolios and missing direct equivalents are identified in the row notes; regulated-environment availability and feature parity stay `Unknown` unless public official evidence supports a firmer value.

Source rules are documented in [data/SOURCE-POLICY.md](data/SOURCE-POLICY.md). Compliance and shipped-feature claims remain strict, while documented roadmap claims can use enumerated official first-party engineering or security blogs at a Medium confidence cap.

**Current coverage:** 30 architecture decision rows across 14 categories and four providers, plus 120 provider-level FedRAMP objects, 20 PQC readiness objects, 10 sovereignty/residency offerings, 4 curated architecture-pattern overlays, 11 compliance framework references, 11 selected NIST SP 800-53 Rev. 5 control-family mappings, 12 cloud-history milestones, 5 official operational status sources, 6 official AI lab watch sources, and 51 state/DC AI transparency rows, in matrix data version `3.21.0`.

---

## What's in it

### Data model (per capability)

| Field | Description |
|---|---|
| `tags` | STANDARD, AI_CAPABLE, AI_NATIVE, GOV_AVAILABLE, GOV_LIMITED, PARITY_LAG, COMPLIANCE_RELEVANT, ENTERPRISE_CORE, HYBRID_READY, IDENTITY_CRITICAL, COST_SENSITIVE, LOCK_IN_RISK |
| `aiClassification` | STANDARD / AI_CAPABLE / AI_NATIVE |
| `govAvailability` | Full / Partial / Limited / None / Unknown - documented regulated-environment availability per provider |
| `govVariant` | Name of the government cloud offering |
| `region` | Optional provider-level region or realm label when official evidence supports one |
| `realmClass` | Optional provider-level realm class: `commercial`, `us-gov`, `eu-sovereign`, or `other-sovereign` |
| `parityLag` | None / Minor / Moderate / Significant / Unknown - separately verified commercial vs regulated comparison |
| `parityDetail` | Optional provider-level parity rationale surfaced near `parityLag`; sourced through proposals before use |
| `constraints` | Optional provider-specific constraint notes or structured metadata |
| `costModel` | Optional provider-specific cost-shape metadata: consumption / provisioned / hybrid, egress sensitivity, and commitment discount availability |
| `pqcReadiness` | Optional post-quantum cryptography readiness metadata, including status, FIPS endpoint parity, government PQC notes, source date, first-party indicator, confidence, and official source when sourced through proposals |
| `residency` | Optional provider-level sovereignty/residency offerings for the Government / Sovereign Cloud Offerings row, including offering, guarantee, geography, status, official source, and first-party versus partner-operated flag |
| `fedramp` | Optional nested commercial and government FedRAMP metadata with authorization level, DoD impact level, boundary, date, confidence, and official source when sourced through proposals |
| `fedrampLevel` / `dodImpactLevel` | Legacy flat authorization-level metadata retained for compatibility; prefer `fedramp` for new proposal-reviewed values |
| `architectureNotes` | Operational and architectural context |
| `operationalConsiderations` | Real-world deployment realities |
| `tierNotes` | Per-tier notes (Personal / SMB / Enterprise / Government) |
| `docsUrl` | Official provider documentation |
| `pricingUrl` | Official pricing page |
| `complianceUrl` | Official compliance/certification page |
| `govDocsUrl` | Government cloud documentation |
| `formerNames` | Optional prior or merged product names, used where official provider sources document lineage |
| `lastVerified` | Date last manually reviewed |
| `sourceNotes` | Required explanation when a public-source fact is unknown or unavailable |
| `controlLens` | NIST SP 800-53 Rev. 5 control-family planning mappings to relevant capability decisions; not an assessment result |

### Regulated availability reading guide

`govAvailability` records public evidence of product availability in the named government or regulated environment, not approval for a workload and not commercial feature parity:

| Value | Interpretation |
|---|---|
| `Full` | Official evidence identifies all mapped products as available in the named environment. Required features and parity still need separate review. |
| `Partial` | Official evidence establishes some mapped components or product support limited to specified control packages. |
| `Limited` | Official evidence establishes availability and also identifies material environment-specific limitations relevant to architecture review. |
| `Unknown` | Public evidence has not yet established a stronger statement for the mapped service or portfolio. |

The regulated-foundation pass in `3.6.0` applies this rubric to control-boundary capabilities, and the high-use core-service pass in `3.7.0` covers virtual machines, serverless functions, object storage, managed Kubernetes, and managed relational databases. The OCI onboarding pass in `3.9.0` maps all current capabilities, including OCI Generative AI, OCI Data Science, and OCI Resource Manager. The AI architecture depth pass in `3.10.0` adds agent orchestration, vector retrieval/RAG knowledge bases, and accelerated AI/GPU compute across all four providers. The regulated AI evidence pass in `3.11.0` records supported AWS GovCloud, Azure Government, Google Assured Workloads, and Oracle Integration U.S. Government Cloud statements only where official documentation is specific enough. Later `3.16.x` passes add state AI transparency records, link-check hygiene, and Microsoft Foundry lineage support. Agent availability, unlisted OCI/GCP products, and all `parityLag` comparisons remain `Unknown` unless directly established.

### View modes

| Mode | Purpose |
|---|---|
| **Matrix** | All capabilities by tier, click to expand full detail + links |
| **Patterns** | Framework-informed planning overlays with provider service maps and review boundaries |
| **Compliance** | Framework references plus the selected NIST SP 800-53 Rev. 5 planning lens |
| **History** | Provider cloud journey milestones |
| **Operational Status** | Official provider status pages and incident-history sources |
| **AI Watch** | Official frontier and foundation-model release source index |
| **AI Transparency** | State AI governance and transparency public-record view |
| **Equivalency** | Side-by-side service mapping (AWS ↔ Azure ↔ GCP ↔ OCI) |
| **Gov / Parity** | Government availability and parity lag focus |
| **AI Focus** | AI_NATIVE and AI_CAPABLE capabilities only |

### Architecture patterns

Patterns connect sourced capability rows into four practical planning starts: secure internet-facing applications, regulated workload control boundaries, governed data and generative AI platforms (including RAG, agents, and accelerator planning), and hybrid migration and recovery paths. They are curated overlays inferred from the official framework and foundation guidance above, not provider-certified blueprints or compliance determinations.

### NIST SP 800-53 Rev. 5 control lens

The control lens maps selected NIST control families to cloud architecture decisions, including Terraform/provider-native IaC workflows and AI touchpoints for agent tool authorization and protected retrieval data paths. It is intended to help architects identify implementation touchpoints and evidence questions; it is not a control applicability decision, control implementation statement, assessment, or authorization.

Official sources: [NIST SP 800-53 Rev. 5 catalog](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final), [SP 800-53B control baselines](https://csrc.nist.gov/pubs/sp/800/53/b/upd1/final), and [NIST OSCAL content](https://github.com/usnistgov/oscal-content/tree/main/nist.gov/SP800-53/rev5).

### Categories (14)
Core Infrastructure · Identity & Access · Networking · Storage · Databases · Integration & Messaging · Security & Compliance · Monitoring & Operations · Data & Analytics · AI / ML · Developer Platform · Government / Sovereign Cloud · Hybrid / Edge · Cost Governance

---

## How it stays current

| Workflow | Schedule | What it does |
|---|---|---|
| `verify.yml` | Every PR/push; weekly link scan | Blocking schema/data validation; non-blocking public URL review |
| `update-check.yml` | Every Wednesday; manual dispatch | Opens a review issue from official AWS/GCP feeds and Microsoft's documented Azure Updates Release Communications MCP source, with Oracle OCI release notes listed for manual review |
| `deploy.yml` | Every push to `main` | Generates XLSX, including architecture-pattern worksheet, + builds React app → deploys to GitHub Pages |

**Human in the loop:** Automation surfaces changes, humans validate and commit. No automated writes to data files.

The update monitor surfaces product changes; additions and revisions to architecture-framework interpretation are reviewed manually against official provider guidance. Oracle's official OCI release notes and AI lab watch sources are currently manual-review sources until reliable documented feeds or APIs are adopted.

---

## Data philosophy

- Official public provider documentation only
- No pricing speculation
- No "best cloud" opinions
- Compliance relevance, not compliance guarantees
- Availability is not parity; unknowns stay visible until official evidence supports a comparison
- Parity lag tracked explicitly, not hidden
- Every URL verifiable by anyone
- Not legal, compliance, procurement, or security advice

---

## Running locally

```bash
npm install
pip install openpyxl

npm run dev              # Start dev server
python scripts/verify.py          # Validate data locally (no network)
python scripts/verify.py --schema-only   # Validate matrix contract only
python scripts/verify.py --check-links   # Review public links (warnings only)
python scripts/generate_xlsx.py   # Generate Excel
python scripts/check_upcoming.py  # Scan for updates
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions require an official source URL. PRs that fail `verify.py` will not be merged.

**Schema:** [`data/schema.json`](data/schema.json) defines `data/matrix.json` (capability-v1); see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance.

---

## License

Data: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · Code: [MIT](LICENSE)

See [DISCLAIMER.md](DISCLAIMER.md). Not affiliated with Amazon, Microsoft, Google, Oracle, AWS, Azure, Google Cloud, or Oracle Cloud Infrastructure.

## Overview
Enterprise and government cloud capability intelligence — AWS · Azure · GCP

## Quick Start
Add setup and run steps for this repository.

## Project Status
Active development.

