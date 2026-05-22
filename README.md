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
| `verify.yml` | Every Monday | Schema check + HTTP source validation → opens Issue on failure |
| `update-check.yml` | Every Wednesday | Scans official RSS feeds → opens review Issue |
| `deploy.yml` | Every push to `main` | Generates XLSX + builds React app → deploys to GitHub Pages |

**Human in the loop:** Automation surfaces changes, humans validate and commit. No automated writes to data files.

---

## Data philosophy

- Official public provider documentation only
- No pricing speculation
- No "best cloud" opinions
- Compliance relevance, not compliance guarantees
- Parity lag tracked explicitly, not hidden
- Every URL verifiable by anyone
- Not legal, compliance, procurement, or security advice

---

## Running locally

```bash
npm install
pip install openpyxl

npm run dev              # Start dev server
python scripts/verify.py          # Validate data
python scripts/generate_xlsx.py   # Generate Excel
python scripts/check_upcoming.py  # Scan for updates
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions require an official source URL. PRs that fail `verify.py` will not be merged.

**Schema:** `data/matrix.json` (capability-v1) — [full schema docs in CONTRIBUTING.md]

---

## License

Data: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · Code: [MIT](LICENSE)

See [DISCLAIMER.md](DISCLAIMER.md). Not affiliated with Amazon, Microsoft, Google, AWS, Azure, or Google Cloud.
