# Contributing

## Rules

1. **Official sources only.** Every data point needs a public provider URL.
2. **No pricing tables.** We note when cost matters (COST_SENSITIVE tag), not exact prices.
3. **Compliance relevance, not compliance guarantees.** Tag COMPLIANCE_RELEVANT; don't claim "this is compliant."
4. **govAvailability must be accurate.** Full / Partial / Limited / None — check the gov cloud docs.
5. **parityLag must be honest.** If gov is behind commercial, say so.
6. **No sensitive information.** No internal docs, NDA roadmaps, or customer-specific data.
7. **verify.py must pass.** Run locally before submitting a PR.

## Schema fields (capability-v1)

```json
{
  "capability": "Human-readable name",
  "category": "One of the 14 categories",
  "tags": ["STANDARD", "ENTERPRISE_CORE"],
  "architectureNotes": "Architectural context and tradeoffs",
  "operationalConsiderations": "Real-world deployment realities",
  "lastVerified": "YYYY-MM-DD",
  "providers": {
    "aws": {
      "service": "Official service name",
      "status": "GA | Preview | Deprecated",
      "govAvailability": "Full | Partial | Limited | None",
      "govVariant": "Name of gov cloud offering",
      "parityLag": "None | Minor | Moderate | Significant",
      "docsUrl": "https://docs.aws.amazon.com/...",
      "pricingUrl": "https://aws.amazon.com/...",
      "complianceUrl": "https://aws.amazon.com/compliance/",
      "govDocsUrl": "https://docs.aws.amazon.com/govcloud-us/...",
      "tierNotes": {
        "Personal / Free": "...",
        "Commercial / SMB": "...",
        "Enterprise": "...",
        "Government": "..."
      }
    }
  }
}
```

## Tag definitions

| Tag | Use when |
|---|---|
| STANDARD | Traditional cloud infra, not AI-specific |
| AI_CAPABLE | Can support AI workloads (analytics, search, K8s) but not purpose-built |
| AI_NATIVE | Purpose-built AI/ML service (Bedrock, Azure OpenAI, Vertex AI) |
| GOV_AVAILABLE | Full parity in gov region |
| GOV_LIMITED | Available in gov but feature/model/region constrained |
| PARITY_LAG | Commercial version is ahead of gov/regulated version |
| COMPLIANCE_RELEVANT | Important for NIST/CJIS/HIPAA/FedRAMP/FIPS architecture review |
| ENTERPRISE_CORE | Common foundational service in enterprise architectures |
| HYBRID_READY | Strong on-prem/cloud integration support |
| IDENTITY_CRITICAL | Depends heavily on IAM/Entra/SSO/RBAC design |
| COST_SENSITIVE | Can become expensive without active governance |
| LOCK_IN_RISK | High coupling to provider ecosystem; migration friction |

## What not to submit

- Pricing tables or cost estimates
- "X is better than Y" opinions  
- Information from non-public sources
- AI-generated content without manual verification against official docs
- Anything requiring a cloud account to verify
