# Changelog

Format: `[YYYY-MM-DD] Provider | Category | Capability — Change (source)`

---

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
