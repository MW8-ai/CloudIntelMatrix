# ☁️ Cloud Intelligence Matrix

> Enterprise and government cloud capability intelligence — AWS · Azure · GCP

**[Live →](https://mw8-ai.github.io/CloudIntelMatrix/)** &nbsp;|&nbsp; **[XLSX →](https://mw8-ai.github.io/CloudIntelMatrix/Cloud_Intelligence_Matrix.xlsx)** &nbsp;|&nbsp; **[Report a correction →](https://github.com/MW8-ai/CloudIntelMatrix/issues/new/choose)**

---

## What this is

A provider-neutral, fact-first reference for enterprise architects, platform engineers, government IT professionals, and security teams making cloud decisions.

**Not** a "top cloud" ranking, affiliate content, or AI hype. **Yes** to operational reality, governance visibility, parity lag tracking, and compliance-aware architecture.

See [DISCLAIMER.md](DISCLAIMER.md) for affiliation and compliance guidance.

---

## What's in it

### 20 capabilities across 14 categories

| Category | Capabilities |
|---|---|
| Core Infrastructure | Virtual Machines, Serverless Functions, Managed Kubernetes |
| Identity & Access | IAM |
| Networking | Virtual Networking & CDN |
| Storage | Object Storage |
| Databases | Relational Databases |
| Integration & Messaging | Event Streaming & Messaging, Managed File Transfer / API Management |
| Security & Compliance | Security & Compliance Posture |
| Monitoring & Operations | Observability & Monitoring |
| Data & Analytics | Data Warehouse & Analytics |
| AI / ML | Generative AI / Foundation Models, ML Platform & Model Training |
| Developer Platform | DevOps / CI-CD Platform |
| Government / Sovereign Cloud | Government / Sovereign Cloud Regions |
| Hybrid / Edge | Hybrid & On-Premises Extension, Cloud Migration Tooling |
| Cost Governance | Cloud Cost Management & FinOps |

### Data model (per capability)

| Field | Description |
|---|---|
| `tags` | STANDARD, AI_CAPABLE, AI_NATIVE, GOV_AVAILABLE, GOV_LIMITED, PARITY_LAG, COMPLIANCE_RELEVANT, ENTERPRISE_CORE, HYBRID_READY, IDENTITY_CRITICAL, COST_SENSITIVE, LOCK_IN_RISK |
| `govAvailability` | Full / Partial / Limited / None — per provider |
| `govVariant` | Name of the government cloud offering |
| `parityLag` | None / Minor / Moderate / Significant — commercial vs gov |
| `architectureNotes` | Operational and architectural context |
| `operationalConsiderations` | Real-world deployment realities |
| `tierNotes` | Per-tier notes (Personal / SMB / Enterprise / Government) |
| `docsUrl` | Official provider documentation |
| `pricingUrl` | Official pricing page |
| `complianceUrl` | Official compliance/certification page |
| `govDocsUrl` | Government cloud documentation |
| `lastVerified` | Date last manually reviewed |

### View modes

| Mode | Purpose |
|---|---|
| **Matrix** | All capabilities by tier; click any row to expand full detail + all official links |
| **Equivalency** | Side-by-side service mapping (AWS ↔ Azure ↔ GCP) |
| **Gov / Parity** | Government availability and parity lag focus |
| **AI Focus** | AI_NATIVE and AI_CAPABLE capabilities only |

---

## How it stays current

| Workflow | Schedule | What it does |
|---|---|---|
| `verify.yml` | Every Monday | Schema validation + HTTP source check → opens Issue on failure |
| `update-check.yml` | Every Wednesday | Scans GCP/AWS/Azure RSS release feeds → opens review Issue |
| `deploy.yml` | Every push to `main` | Builds React app → deploys to GitHub Pages |

**Human in the loop:** Automation surfaces changes, humans validate and commit. No automated writes to data files.

---

## Data philosophy

- Official public provider documentation only
- No pricing speculation
- No "best cloud" opinions
- Compliance **relevance**, not compliance guarantees
- Parity lag tracked explicitly, not hidden
- Every URL verifiable by anyone
- See [DISCLAIMER.md](DISCLAIMER.md)

---

## Running locally

```bash
npm install
pip install openpyxl

npm run dev                        # Start dev server at localhost:5173
python scripts/verify.py          # Validate data schema + source URLs
python scripts/generate_xlsx.py   # Generate Excel export
python scripts/check_upcoming.py  # Scan RSS feeds for provider updates
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions require an official source URL. PRs that fail `python scripts/verify.py` will not be merged.

**Issue templates:**
- [Data Correction](https://github.com/MW8-ai/CloudIntelMatrix/issues/new?template=data-correction.yml) — fix an incorrect or outdated entry
- [New Capability / Service](https://github.com/MW8-ai/CloudIntelMatrix/issues/new?template=new-service.yml) — propose adding a capability

---

## License

Data (`data/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) &nbsp;·&nbsp; Code: [MIT](LICENSE)

Not affiliated with Amazon, Microsoft, or Google. See [DISCLAIMER.md](DISCLAIMER.md).
