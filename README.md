# ☁️ Cloud Intelligence Matrix

> Enterprise and government cloud capability intelligence — AWS · Azure · GCP

**[Live →](https://mw8-ai.github.io/CloudIntelMatrix/)** &nbsp;|&nbsp; **[XLSX →](https://mw8-ai.github.io/CloudIntelMatrix/Cloud_Intelligence_Matrix.xlsx)** &nbsp;|&nbsp; **[Report a correction →](https://github.com/MW8-ai/CloudIntelMatrix/issues/new/choose)**

---

## What this is

A provider-neutral, fact-first reference for enterprise architects, platform engineers, government IT, and security teams making cloud decisions.

**Not** a "top cloud" ranking, affiliate content, or AI hype. **Yes** to operational reality, governance visibility, parity lag tracking, and compliance-aware architecture.

---

## What's in it

### Data model (per capability)

| Field | Description |
|---|---|
| `tags` | STANDARD, AI_CAPABLE, AI_NATIVE, GOV_AVAILABLE, GOV_LIMITED, PARITY_LAG, COMPLIANCE_RELEVANT, ENTERPRISE_CORE, HYBRID_READY, IDENTITY_CRITICAL, COST_SENSITIVE, LOCK_IN_RISK |
| `aiClassification` | STANDARD / AI_CAPABLE / AI_NATIVE |
| `govAvailability` | Full / Partial / Limited / None / Unknown - documented regulated-environment availability per provider |
| `govVariant` | Name of the government cloud offering |
| `parityLag` | None / Minor / Moderate / Significant / Unknown - separately verified commercial vs regulated comparison |
| `architectureNotes` | Operational and architectural context |
| `operationalConsiderations` | Real-world deployment realities |
| `tierNotes` | Per-tier notes (Personal / SMB / Enterprise / Government) |
| `docsUrl` | Official provider documentation |
| `pricingUrl` | Official pricing page |
| `complianceUrl` | Official compliance/certification page |
| `govDocsUrl` | Government cloud documentation |
| `lastVerified` | Date last manually reviewed |
| `sourceNotes` | Required explanation when a public-source fact is unknown or unavailable |

### View modes

| Mode | Purpose |
|---|---|
| **Matrix** | All capabilities by tier, click to expand full detail + links |
| **Equivalency** | Side-by-side service mapping (AWS ↔ Azure ↔ GCP) |
| **Gov / Parity** | Government availability and parity lag focus |
| **AI Focus** | AI_NATIVE and AI_CAPABLE capabilities only |

### Categories (14)
Core Infrastructure · Identity & Access · Networking · Storage · Databases · Integration & Messaging · Security & Compliance · Monitoring & Operations · Data & Analytics · AI / ML · Developer Platform · Government / Sovereign Cloud · Hybrid / Edge · Cost Governance

---

## How it stays current

| Workflow | Schedule | What it does |
|---|---|---|
| `verify.yml` | Every PR/push; weekly link scan | Blocking schema/data validation; non-blocking public URL review |
| `update-check.yml` | Every Wednesday; manual dispatch | Opens a review issue from official AWS/GCP feeds plus an Azure Updates manual-review prompt |
| `deploy.yml` | Every push to `main` | Generates XLSX + builds React app → deploys to GitHub Pages |

**Human in the loop:** Automation surfaces changes, humans validate and commit. No automated writes to data files.

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

See [DISCLAIMER.md](DISCLAIMER.md). Not affiliated with Amazon, Microsoft, Google, AWS, Azure, or Google Cloud.
