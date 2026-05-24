# Contributing

## Rules

1. **Official sources only.** Every data point needs a public provider URL.
2. **No pricing tables.** We note when cost matters (COST_SENSITIVE tag), not exact prices.
3. **Compliance relevance, not compliance guarantees.** Tag COMPLIANCE_RELEVANT; don't claim "this is compliant."
4. **govAvailability must be accurate.** Full / Partial / Limited / None / Unknown describes documented availability, not commercial-feature parity. Check public regulated-environment docs and explain unknowns with `sourceNotes`.
5. **parityLag must be separately proven.** Do not infer parity from availability. Use `Unknown` with `sourceNotes` when current public documentation does not establish the comparison.
6. **No sensitive information.** No internal docs, NDA roadmaps, or customer-specific data.
7. **verify.py must pass.** Run `python scripts/verify.py` locally before submitting a PR; use `--check-links` for a non-blocking public URL review.

## Schema fields (capability-v1)

```json
{
  "capability": "Human-readable name",
  "category": "One of the 14 categories",
  "tags": ["STANDARD", "ENTERPRISE_CORE"],
  "aiClassification": "STANDARD | AI_CAPABLE | AI_NATIVE",
  "architectureNotes": "Architectural context and tradeoffs",
  "operationalConsiderations": "Real-world deployment realities",
  "lastVerified": "YYYY-MM-DD",
  "providers": {
    "aws": {
      "service": "Official service name",
      "status": "GA | Preview | Deprecated | Retiring | Unknown",
      "govAvailability": "Full | Partial | Limited | None | Unknown",
      "govVariant": "Name of gov cloud offering",
      "parityLag": "None | Minor | Moderate | Significant | Unknown",
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

Use `sourceNotes` on a capability or provider when an official public source does not state a needed value. Unknowns are allowed; unsupported guesses and unsupported comparative rankings are not.

## Tag definitions

| Tag | Use when |
|---|---|
| STANDARD | Traditional cloud infra, not AI-specific |
| AI_CAPABLE | Can support AI workloads (analytics, search, K8s) but not purpose-built |
| AI_NATIVE | Purpose-built AI/ML service (Bedrock, Azure OpenAI, Vertex AI) |
| GOV_AVAILABLE | Documented as available in a government or regulated environment |
| GOV_LIMITED | Documented in government or regulated use with identified constraints |
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
