# CloudIntelMatrix Source Policy

The evidence bar must match what a claim asserts. `Unknown` remains the correct value when an official source does not support a stronger claim.

## Source Tiers

| Tier | Claim type | Acceptable sources | Confidence cap |
|---|---|---|---|
| 1 | Compliance and authorization claims, including `fedramp` Moderate/High and `dodIL` | FedRAMP Marketplace, DISA/DoD listings, and provider audit-scope or services-in-scope compliance pages | High |
| 2 | Shipped feature claims, including PQC `GA`, `Preview`, and `Hybrid-Preview` | Provider product documentation domains: `docs.aws.amazon.com`, `aws.amazon.com/security/...`, `aws.amazon.com/compliance/...`, `learn.microsoft.com`, `docs.cloud.google.com`, `cloud.google.com/docs/...`, and `docs.oracle.com` | High |
| 3 | Program or roadmap claims, including PQC `Roadmap` | Official first-party engineering/security blogs: `blogs.oracle.com`, `www.microsoft.com/*/security/blog`, `techcommunity.microsoft.com`, `aws.amazon.com/blogs`, and `cloud.google.com/blog` | Medium |

## PQC Roadmap Rule

Roadmap claims assert that a provider has made an official program or target statement. Providers often publish those statements through first-party security or engineering blogs before shipped product documentation exists. Tier 3 is therefore acceptable for PQC `Roadmap` claims only, and Tier 3 roadmap claims are capped at `Medium` confidence.

Tier 3 is not acceptable for PQC `GA`, `Preview`, or `Hybrid-Preview` claims. Those require Tier 2 product documentation.

## Compliance Rule

Compliance and authorization claims remain strictest. Blogs are not acceptable for FedRAMP, DoD impact level, or other compliance-scope assertions. For example, the OCI FedRAMP Relational Databases row remains `Unknown` unless a Tier 1 compliance source supports a stronger value.
