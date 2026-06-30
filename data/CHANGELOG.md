# Changelog

Format: `[YYYY-MM-DD] Provider | Category | Capability — Change (source)`

---

## 2026-06-30 - Matrix evidence clarity
- Clarified Matrix provider evidence counts, added expandable found/gap row detail, prioritized selected tier notes in Matrix previews, updated the product title copy, and moved light mode to a cooler neutral palette.

## 2026-06-29 - Matrix filter and news polish
- Replaced Matrix coverage percentages with official-source evidence counts, moved Matrix export controls into the primary filter row, made the top navigation wrap on narrow screens, and renamed the upcoming panel as global cloud provider news with two visible items by default.

## 2026-06-29 - Coverage bar runtime fix
- Restored the Matrix coverage bar denominator used for visual segment widths after replacing percentage labels with evidence counts.

## 2026-06-29 - Matrix UX tightening
- Moved the high-use Matrix provider, tier, category, and density controls closer to the table, clarified coverage percentages, restored the hidden reading-guide affordance, and added detailed-cell source snippets and links.
- Restored the design-style AI Focus lens with grouped AI-native and AI-capable cards, provider service rows, and Matrix detail-panel access.

## 2026-06-29 - Equivalency lens consolidation
- Folded Service Equivalency into the Matrix view lens selector while preserving its side-by-side provider mapping layout, export behavior, and legacy `view=diff` URL routing.

## 2026-06-29 - Matrix view lens consolidation
- Folded AI Focus and Gov / Parity into Matrix view lenses, keeping the top navigation focused while preserving filtered exports and legacy URL behavior.

## 2026-06-29 - Front-page category polish
- Reworked the Matrix front-page filters so search has its own row, provider / tier / category controls are grouped as primary controls, and layer / AI / density controls stay organized below while preserving existing filters and exports.

## 2026-06-29 - State AI transparency batch
- Populated Massachusetts, New Jersey, and Oregon AI governance transparency rows from official state executive order and action-plan sources.

## 2026-06-28 - Matrix handoff polish
- Added the handoff-requested Matrix reading key, layer filter chips, AI scope chips, and detailed/compact density control while preserving the existing React/Vite data pipeline and removing the runtime Google Fonts import.

## 2026-06-27 - Realm-class planning
- Added a provider-neutral realm-class planning note for future regulated and sovereign environment schema work, without changing matrix data or current summary fields.

## 2026-06-27 - Task 5 AI / ML regulated availability proposals
- Added a proposal-only batch for selected AI / ML regulated availability and parity gaps covering Amazon Bedrock, Bedrock Knowledge Bases, AI agent orchestration, Azure Microsoft Sentinel availability, and OCI Generative AI government/sovereign region evidence.

## 2026-06-27 - Visual design port
- Ported the external visual design treatment into the React/Vite app with local provider/logo assets, refreshed theme tokens, matrix coverage cards, a slide-over matrix detail panel, and a chronological cloud timeline while preserving source JSON data and exports.

## 2026-06-27 - Roadmap TODO
- Added a durable `TODO.md` roadmap with current unknown counts, next proposal batches, transparency expansion, realm-class planning, design-review follow-up, and validation guardrails.

## 2026-06-26 - Deploy workflow validation hardening
- Aligned the GitHub Pages deploy workflow with the verified build path by using `npm ci` and running data/view-model validation before build and export generation.

## 2026-06-26 - PR verification build/export coverage
- Extended the verify workflow to install export dependencies, run the Vite build, and generate XLSX/static CSV exports on pull requests and pushes.

## 2026-06-26 - Legacy view cleanup
- Removed unused pre-redesign view components from `src/App.jsx` after the redesigned Matrix, AI Focus, Architecture Patterns, Compliance, Government/Parity, Equivalency, History, and State AI Transparency views were wired in.

## 2026-06-26 - Reference view design polish
- Ported Government/Parity, Equivalency, History, and State AI Transparency views to the redesigned card-and-provider-tile treatment while preserving existing source data, filters, and exports.

## 2026-06-26 - Secondary view design polish
- Ported AI Focus, Architecture Patterns, and Compliance views to the redesigned card-and-provider-tile treatment while preserving existing source data, filters, and exports.

## 2026-06-26 - New design matrix view
- Ported the capability matrix surface to the design-view adapter with architecture-layer grouping, provider coverage summaries, and a detail rail while preserving existing data sources and export behavior.

## 2026-06-25 - New design transition adapter
- Added a source-JSON-to-design-view-model adapter and CI verification step so the redesigned front-end can be ported without making prototype-transcribed data authoritative.

## 2026-06-25 - README version consistency
- Updated the README current-coverage note to match matrix data version `3.16.6`.

## 2026-06-25 - Azure pricing link-check noise reduction
- Changed the public link checker to report repeated Azure pricing-page timeouts as informational output instead of recurring warnings, while preserving warnings for actual HTTP/link failures.

## 2026-06-25 - Issue #54 late high-value update triage
- Added `upcoming.json` tracking entries for Azure Application Gateway for Containers inference gateway preview, Amazon EC2 AMI Watermarks, and Amazon GuardDuty AI-powered investigations preview from official provider sources.

## 2026-06-25 - Issue #54 GCP platform triage
- Added `upcoming.json` tracking entries for Gemini Enterprise Agent Platform GA agent gateway, observability, registry, and Terraform support; Google Cloud API Gateway runtime architecture behavior; and BigQuery autonomous embedding generation from official Google Cloud release notes.

## 2026-06-25 - Issue #54 AWS accelerated compute triage
- Added `upcoming.json` tracking entries for Amazon EC2 G7 general availability and SageMaker notebook G6e/G7e accelerator support from official AWS announcements.

## 2026-06-25 - Issue #54 AWS CloudWatch triage
- Added `upcoming.json` tracking entries for Amazon CloudWatch Logs managed syslog ingestion and CloudWatch OTel Container Insights for Amazon EKS from official AWS announcements.

## 2026-06-25 - Issue #54 AWS Bedrock AI triage
- Added `upcoming.json` tracking entries for Amazon Bedrock AgentCore Memory cross-account access and Amazon Bedrock Guardrails automated reasoning policy-refinement workflows from official AWS announcements.

## 2026-06-25 - Issue #54 GCP AI Hypercomputer triage
- Added an `upcoming.json` tracking entry for Google Cloud AI Hypercomputer preview cluster-planning and RoCE VPC/MRDMA networking updates from official Google Cloud release notes.

## 2026-06-25 - Issue #54 Azure Migrate preview triage
- Added an `upcoming.json` tracking entry for Azure Migrate GitHub Copilot Modernization code insights preview using official Microsoft Learn documentation.

## 2026-06-25 - Issue #54 Azure retirement triage
- Added `upcoming.json` tracking entries for Azure VM size-series retirements and Azure Load Balancer Inbound NAT Pools retirement using official Microsoft Learn sources.

## 2026-06-24 - v3.16.6 - Approved fact proposals
- Applied 1 approved fact proposal(s) from `data/proposals/fedramp-link-freshness-2026-06-24.json` across 1 record(s).

## 2026-06-24 - Category icon polish
- Added static category icons to matrix category chips, filter buttons, section dividers, and compact comparison labels without changing category keys or data values.

## 2026-06-24 - Weekly update triage
- Added AWS Lambda MicroVMs to `upcoming.json` for Serverless Functions boundary review from the official AWS announcement.

## 2026-06-24 - Shareable sticky controls
- Consolidated search, tier lens, provider filters, and theme switching into a sticky control bar, with URL-shareable view and filter state.

## 2026-06-24 - Glossary tooltips
- Added shared UI glossary definitions and hover/focus/tap tooltips for capability tags, government availability badges, and parity lag badges.

## 2026-06-24 - v3.16.5 - Approved fact proposals
- Applied 3 approved fact proposal(s) from `data/proposals/foundry-lineage-2026-06-24.json` across 1 capability/provider record(s).

## 2026-06-24 - Foundry lineage field support
- Added optional provider `formerNames` support across schema validation, proposal application, browser display, CSV/XLSX exports, and search.

## 2026-06-23 - Link-check cadence hygiene
- Updated the public link checker to retry with GET when a source returns a method-sensitive HEAD response, reducing false warnings for official source pages that are reachable in a browser.

## 2026-06-23 - v3.16.4 - Approved fact proposals
- Applied 22 approved fact proposal(s) from `data/proposals/regulated-availability-cleanup-2026-06-23.json` across 15 capability/provider record(s).

## 2026-06-23 - Transparency v1.1.0 - State AI public-record expansion
- Populated 9 additional official-source state AI governance and transparency rows for California, Connecticut, Maryland, Minnesota, New York, Pennsylvania, Texas, Utah, and Washington.
- Kept Colorado out of this batch because its enacted AI Act requirements are not yet operative as of 2026-06-23.

## 2026-06-23 - Issue #44 update-review triage
- Added `upcoming.json` tracking entries for AWS Transform FSx for NetApp ONTAP migration preview and Azure legacy Blob / GPv1 storage-account retirement using official provider sources.
- Left GA feature announcements and non-mapped retirements from issue #44 out of `matrix.json`; any future matrix fact changes still require proposal review.

## 2026-06-23 - Fact proposal workflow issue fallback
- Updated the scheduled fact-proposal workflow to publish generated worklist branches and open a review issue instead of failing when GitHub Actions cannot create pull requests.

## 2026-06-16 - v3.16.3 - Approved fact proposals
- Applied 6 approved fact proposal(s) from `data/proposals/analytics-ops-integration-parity-2026-06-16.json` across 5 capability/provider record(s).
- Updated proposal validation so approved proposal files validate against applied matrix values while unapproved files still validate against current matrix values.

## 2026-06-16 - Client XLSX export dependency removal
- Removed the vulnerable client-side `xlsx` package and replaced per-view XLSX downloads with a local minimal OOXML workbook writer.
- Preserved CSV, XLSX, and print/PDF export controls while reducing the production bundle size and clearing npm audit findings.

## 2026-06-15 - v3.16.2 - Approved fact proposals
- Applied 5 approved fact proposal(s) from `data/proposals/enterprise-foundation-parity-2026-06-15.json` across 5 capability/provider record(s).

## 2026-06-15 - v3.16.1 - Approved fact proposals
- Applied 5 approved fact proposal(s) from `data/proposals/core-service-parity-2026-06-15.json` across 5 capability/provider record(s).

## 2026-06-16 - Task 5 analytics, operations, and integration proposals
- Added a proposal-only batch for ML Platform & Model Training, Data Warehouse / Analytics Platform, Managed File Transfer, Observability & Monitoring, and Event Streaming & Messaging.
- Proposed AWS parity values for SageMaker AI, Redshift, Transfer Family, CloudWatch Logs, and EventBridge using official AWS GovCloud service-difference documentation.
- Proposed AWS EventBridge `govAvailability: Limited` from the same official AWS GovCloud source while leaving other providers as review work items only.

## 2026-06-15 - Task 5 enterprise-foundation parity proposals
- Added a proposal-only batch for five enterprise foundation parity cells: Identity & Access Management, Key/Secret/Certificate Management, Private Connectivity & DNS, Backup & Disaster Recovery, and Landing Zone & Resource Governance.
- Proposed AWS parity values for those five rows using official AWS GovCloud service-difference documentation.
- Left Azure, GCP, and OCI parity values as review work items only because this batch did not identify official sources establishing a specific parity lag value.

## 2026-06-15 - Task 5 core-service parity proposals
- Added a proposal-only batch for five high-use core service parity cells: Virtual Machines, Serverless Functions, Object Storage, Managed Kubernetes, and Relational Databases (Managed).
- Proposed AWS `parityLag: Moderate` for those five rows using official AWS GovCloud service-difference documentation.
- Left Azure, GCP, and OCI parity values as review work items only because this batch did not identify official sources establishing a specific parity lag value.

## 2026-06-15 - Fact proposal workflow scaffolding
- Added a proposer workflow for official-source fact review worklists without editing `data/matrix.json`.
- Added a guarded proposal-application helper for human-approved proposal files, including source checks, date updates, changelog entry creation, and matrix version bumping.
- Extended verification to validate proposal files and reject sourceless or non-primary-source fact proposals.

## 2026-06-15 - v3.16.0 - State AI transparency scaffold
- Added `data/transparency.json` as an official-source state AI governance and transparency record with all 50 states plus DC scaffolded and Indiana populated from the State of Indiana AI Policy and Guidance.
- Added Federal Register context for Executive Order 14365, 90 FR 58499, to warn readers that federal-versus-state AI governance remains volatile.
- Added validator, UI tab, client exports, static CSV export, and XLSX sheet support for the transparency view.

## 2026-06-15 - v3.15.0 - Compliance framework expansion
- Added a top-level `complianceFrameworks` dataset covering FedRAMP, GovRAMP, CJIS, HIPAA, FERPA, FIPS 140-2/3, NIST AI RMF, NIST AI 600-1, NIST IR 8596, and NIST COSAiS with official-source URLs and current verification dates.
- Expanded the NIST 800-53 tab into a Compliance view that groups framework references by program type while preserving the existing NIST SP 800-53 Rev. 5 family planning lens.
- Updated schema, validator, client exports, build-time CSV exports, and the XLSX workbook to include the new compliance data without asserting per-service authorization status.

## 2026-06-14 - v3.14.0 - Issue #31 boundary decisions
- Resolved the Azure Functions agent/MCP boundary by keeping Azure Functions in Serverless Functions and clarifying Microsoft Foundry Agent Service as the Azure mapping for AI Agents & Tool Orchestration.
- Strengthened the BigQuery analytics row with official BigQuery ML, Gemini in BigQuery, and BigQuery generative AI function evidence while preserving the existing capability-level AI_CAPABLE classification.
- Kept Synapse Link for Cosmos DB out of upcoming.json because it is not directly mapped, and tightened the existing Microsoft Fabric government-availability watch as the platform-level Azure analytics item.
- Deferred AWS European Sovereign Cloud modeling to a future provider-neutral realm-class dimension; no special AWS-only sovereign profile was added.
- Preserved all govAvailability and parityLag values; no parity or regulated-availability inference was made from commercial feature evidence.

## 2026-06-14 - v3.13.0 - Per-view export tooling
- Added client-side CSV and XLSX exports plus print/save-as-PDF output for the current visible app view without changing any matrix facts.
- Added build-time per-view CSV generation for matrix, equivalency, government/parity, AI focus, architecture patterns, NIST controls, and history.
- Added repo-root agent/task/compliance seed briefs to keep future work aligned to official-source guardrails.

## 2026-06-14 - v3.13.0 - Issue #31 update-review triage

- Recorded official AWS European Sovereign Cloud launch evidence in the sovereign-cloud row and added June 2026 AWS S3 Access Grants and AWS Backup for EKS European Sovereign Cloud source notes without inferring parity.
- Recorded AWS EC2 Capacity Blocks for ML availability in AWS GovCloud (US) Regions as accelerated-compute evidence while preserving `Limited` availability and `Unknown` parity.
- Recorded AWS Lambda Managed Instances and Amazon Q-powered Cost Explorer / AWS FinOps Agent context as commercial/preview evidence; AWS FinOps Agent remains an `upcoming.json` preview item because it is not GA and excludes GovCloud during preview.
- Left Azure Functions agent/MCP feature placement, GCP BigQuery AI impact, and Azure Synapse Link retirement as explicit architecture decision questions rather than changing taxonomy silently.

## 2026-05-26 - v3.12.0 - Regulated data exchange and ML-platform evidence

- Recorded official regulated-environment evidence for analytics-platform decisions: Amazon Redshift as `Limited`, the Azure Synapse Analytics / Microsoft Fabric composite as `Partial`, and BigQuery under Assured Workloads as `Partial`; OCI Autonomous Data Warehouse remains `Unknown` absent mapped-product government evidence.
- Recorded managed-transfer evidence for AWS Transfer Family as `Limited`, Azure Blob Storage SFTP support as `Full`, and Google Storage Transfer Service as control-package-scoped `Partial`, complementing the existing OCI File Server `Limited` evidence.
- Recorded ML platform evidence for Amazon SageMaker AI as `Limited`, Azure Machine Learning as `Full`, and Vertex AI as control-package-scoped `Partial`, alongside existing OCI Data Science evidence.
- Tightened the AWS Agents for Amazon Bedrock retained-`Unknown` note: current official Agents endpoint tables do not identify AWS GovCloud (US) Regions.
- Preserved every `parityLag` value as `Unknown`; regulated availability does not establish commercial feature parity.

## 2026-05-26 - v3.11.0 - Regulated AI and OCI evidence depth

- Recorded official AWS GovCloud evidence for Amazon Bedrock, Knowledge Bases for Amazon Bedrock, and accelerated EC2 instance families, classifying their documented environment-specific constraints conservatively as `Limited`.
- Recorded Azure Government roadmap evidence for Foundry Models, Azure AI Search, and selected GPU-backed virtual machine series as `Partial` mappings; Foundry Agent Service remains `Unknown` because the roadmap identifies it as forecasted rather than currently GA.
- Recorded Google Assured Workloads support for Generative AI on Vertex AI as a control-package-scoped `Partial` mapping while keeping Vertex AI RAG Engine and Agent Engine unasserted for regulated use.
- Recorded Oracle Integration U.S. Government Cloud File Server availability with documented limitations; OCI Generative AI, OCI Generative AI Agents, Autonomous Data Warehouse, Roving Edge Infrastructure, and Oracle Cloud Migrations remain `Unknown` absent mapped-product government evidence.
- Preserved every `parityLag` value as `Unknown`; availability evidence is not commercial feature-parity evidence.

## 2026-05-26 - v3.10.0 - AI architecture depth

- Added three architect-facing AI capability rows across AWS, Azure, GCP, and OCI: AI agents and tool orchestration, vector retrieval and RAG knowledge bases, and accelerated AI compute and GPU infrastructure.
- Extended the governed data and generative AI platform pattern to cover agent tool authorization, retrieval data paths, and accelerator-capacity planning.
- Extended selected NIST SP 800-53 Rev. 5 planning touchpoints for agent authorization and protected retrieval paths.
- Used official provider product documentation for commercial mappings while keeping new regulated availability and parity statements `Unknown` until feature-specific public evidence is established.

## 2026-05-26 - v3.9.0 - OCI and AI foundation

- Added Oracle Cloud Infrastructure (OCI) as a fourth compared provider across all 27 architecture decision rows.
- Added official OCI Well-Architected Framework and OCI Landing Zones guidance to the architecture framework lens.
- Mapped OCI Generative AI and OCI Data Science in AI Focus, and OCI Resource Manager in the Terraform / policy-as-code row.
- Recorded OCI U.S. Government Cloud availability only where Oracle's official endpoint inventory supports the mapped service; uncertain regulated availability and all parity comparisons remain explicit `Unknown` values.
- Added OCI official release notes as a manual review source pending reliable monitoring automation.

## 2026-05-19 — v3.0.0 — Schema redesign (capability-v1)

- Redesigned schema from tier-first to capability-first
- Added tags: STANDARD, AI_CAPABLE, AI_NATIVE, GOV_AVAILABLE, GOV_LIMITED, PARITY_LAG, COMPLIANCE_RELEVANT, ENTERPRISE_CORE, HYBRID_READY, IDENTITY_CRITICAL, COST_SENSITIVE, LOCK_IN_RISK
- Added per-provider: govAvailability, govVariant, parityLag, docsUrl, pricingUrl, complianceUrl, govDocsUrl, tierNotes
- Added capability-level: architectureNotes, operationalConsiderations
- Added UI modes: Matrix, Equivalency, Gov/Parity, AI Focus
- Added search across capability, service, tag, and notes fields
- 11 initial capabilities across 7 categories
- 5 upcoming/announced items
