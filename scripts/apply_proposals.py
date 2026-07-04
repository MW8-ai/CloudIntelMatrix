#!/usr/bin/env python3
"""Apply a human-approved proposal file to matrix.json."""

import argparse
import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
PROVIDER_FIELDS = {
    "service",
    "status",
    "govAvailability",
    "parityLag",
    "parityDetail",
    "govVariant",
    "region",
    "realmClass",
    "lastVerified",
    "formerNames",
    "constraints",
    "costModel",
    "pqcReadiness",
    "fedramp",
    "fedrampLevel",
    "dodImpactLevel",
    "docsUrl",
    "pricingUrl",
    "complianceUrl",
    "govDocsUrl",
    "sourceNotes",
}
ENUMS = {
    "status": {"GA", "Preview", "Deprecated", "Retiring", "Unknown"},
    "govAvailability": {"Full", "Partial", "Limited", "None", "Unknown"},
    "parityLag": {"None", "Minor", "Moderate", "Significant", "Unknown"},
    "realmClass": {"commercial", "us-gov", "eu-sovereign", "other-sovereign"},
    "fedrampLevel": {"High", "Moderate", "Low", "Unknown"},
}
VALID_COST_SHAPE = {"consumption", "provisioned", "hybrid", "Unknown"}
VALID_PQC_STATUS = {"GA", "Hybrid-Preview", "Roadmap", "Unknown", "None"}
VALID_PQC_FIPS_PARITY = {"AtParity", "Lagging", "Unknown"}
VALID_CONFIDENCE = {"High", "Medium", "Low"}
VALID_FEDRAMP_STATUS = {"High", "Moderate", "Low", "None", "Unknown"}
VALID_FEDRAMP_IL = {"IL2", "IL4", "IL5", "IL6", "None", "Unknown"}
URL_FIELDS = {"docsUrl", "pricingUrl", "complianceUrl", "govDocsUrl"}
COMPLIANCE_FRAMEWORK_FIELDS = {"url"}
FACT_URL_FIELDS = URL_FIELDS | COMPLIANCE_FRAMEWORK_FIELDS
OFFICIAL_SOURCE_DOMAINS = {
    "aws.amazon.com",
    "docs.aws.amazon.com",
    "learn.microsoft.com",
    "azure.microsoft.com",
    "cloud.google.com",
    "docs.cloud.google.com",
    "docs.oracle.com",
    "csrc.nist.gov",
    "nist.gov",
    "nccoe.nist.gov",
    "fedramp.gov",
    "govramp.org",
    "fbi.gov",
    "hhs.gov",
    "ed.gov",
    "studentprivacy.ed.gov",
}


class ProposalError(Exception):
    pass


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, payload):
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def validate_url(value, label):
    if value is None:
        return
    parsed = urlparse(str(value))
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ProposalError(f"{label} must be a public HTTP(S) URL")


def validate_https_url(value, label):
    validate_url(value, label)
    if urlparse(str(value)).scheme != "https":
        raise ProposalError(f"{label} must use HTTPS")


def validate_non_empty_string(value, label):
    if not isinstance(value, str) or not value.strip():
        raise ProposalError(f"{label} must be a non-empty string")


def validate_constraints(value, label):
    if isinstance(value, str):
        validate_non_empty_string(value, label)
    elif isinstance(value, dict):
        if not value:
            raise ProposalError(f"{label} must not be an empty object")
    else:
        raise ProposalError(f"{label} must be a non-empty string or object")


def validate_cost_model(value, label):
    if not isinstance(value, dict) or not value:
        raise ProposalError(f"{label} must be a non-empty object")
    allowed = {"shape", "egressSensitive", "commitmentDiscountAvailable"}
    unexpected = set(value) - allowed
    if unexpected:
        raise ProposalError(f"{label} contains unsupported fields: {sorted(unexpected)}")
    if "shape" in value and value.get("shape") not in VALID_COST_SHAPE:
        raise ProposalError(f"{label}.shape invalid: {value.get('shape')}")
    for field in ["egressSensitive", "commitmentDiscountAvailable"]:
        if field in value and not isinstance(value.get(field), bool):
            raise ProposalError(f"{label}.{field} must be boolean")


def validate_pqc_readiness(value, label):
    if not isinstance(value, dict) or not value:
        raise ProposalError(f"{label} must be a non-empty object")
    allowed = {
        "kem",
        "signature",
        "tls",
        "vpn",
        "status",
        "milestoneDate",
        "fipsEndpointParity",
        "govPqc",
        "source",
        "sourceDate",
        "firstParty",
        "confidence",
        "note",
    }
    required = {"status", "fipsEndpointParity", "confidence"}
    unexpected = set(value) - allowed
    if unexpected:
        raise ProposalError(f"{label} contains unsupported fields: {sorted(unexpected)}")
    missing = required - set(value)
    if missing:
        raise ProposalError(f"{label} missing fields: {sorted(missing)}")
    for field in ["kem", "signature", "tls", "vpn", "govPqc", "sourceDate", "note"]:
        if field in value:
            validate_non_empty_string(value.get(field), f"{label}.{field}")
    if "milestoneDate" in value and value.get("milestoneDate") is not None:
        validate_non_empty_string(value.get("milestoneDate"), f"{label}.milestoneDate")
    if value.get("status") not in VALID_PQC_STATUS:
        raise ProposalError(f"{label}.status invalid: {value.get('status')}")
    if value.get("fipsEndpointParity") not in VALID_PQC_FIPS_PARITY:
        raise ProposalError(f"{label}.fipsEndpointParity invalid: {value.get('fipsEndpointParity')}")
    if value.get("confidence") not in VALID_CONFIDENCE:
        raise ProposalError(f"{label}.confidence invalid: {value.get('confidence')}")
    if "firstParty" in value and not isinstance(value.get("firstParty"), bool):
        raise ProposalError(f"{label}.firstParty must be boolean")
    if value.get("source"):
        validate_https_url(value.get("source"), f"{label}.source")
    if value.get("status") != "Unknown":
        if not value.get("source"):
            raise ProposalError(f"{label}.source is required when status is not Unknown")
        if not value.get("sourceDate"):
            raise ProposalError(f"{label}.sourceDate is required when status is not Unknown")
    if value.get("firstParty") is False and not value.get("note"):
        raise ProposalError(f"{label}.note must name the partner when firstParty is false")


def validate_fedramp_environment(value, label, government=False):
    if not isinstance(value, dict):
        raise ProposalError(f"{label} must be an object")
    allowed = {"status", "url", "date", "confidence", "note"}
    if government:
        allowed |= {"dodIL", "boundary"}
    unexpected = set(value) - allowed
    if unexpected:
        raise ProposalError(f"{label} contains unsupported fields: {sorted(unexpected)}")
    status = value.get("status")
    if status not in VALID_FEDRAMP_STATUS:
        raise ProposalError(f"{label}.status invalid: {status}")
    if value.get("confidence") not in VALID_CONFIDENCE:
        raise ProposalError(f"{label}.confidence invalid: {value.get('confidence')}")
    if value.get("url"):
        validate_https_url(value.get("url"), f"{label}.url")
    if status in {"High", "Moderate", "Low"}:
        if not value.get("url"):
            raise ProposalError(f"{label}.url is required when status is {status}")
        if not value.get("date"):
            raise ProposalError(f"{label}.date is required when status is {status}")
    for field in ["date", "boundary", "note"]:
        if field in value and value.get(field) is not None:
            validate_non_empty_string(value.get(field), f"{label}.{field}")
    if government:
        dod_il = value.get("dodIL")
        if dod_il not in VALID_FEDRAMP_IL:
            raise ProposalError(f"{label}.dodIL invalid: {dod_il}")
        if dod_il in {"IL4", "IL5", "IL6"} and status not in {"High", "Moderate"}:
            raise ProposalError(f"{label}.dodIL {dod_il} requires High or Moderate government status")


def validate_fedramp(value, label):
    if not isinstance(value, dict) or not value:
        raise ProposalError(f"{label} must be a non-empty object")
    unexpected = set(value) - {"commercial", "government"}
    if unexpected:
        raise ProposalError(f"{label} contains unsupported fields: {sorted(unexpected)}")
    for environment in ["commercial", "government"]:
        if environment not in value:
            raise ProposalError(f"{label}.{environment} missing")
    if "commercial" in value:
        validate_fedramp_environment(value.get("commercial"), f"{label}.commercial")
    if "government" in value:
        validate_fedramp_environment(value.get("government"), f"{label}.government", government=True)


def normalized_host(url):
    host = urlparse(str(url)).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def is_official_source_url(url):
    host = normalized_host(url)
    if host.endswith(".gov"):
        return True
    return any(host == domain or host.endswith(f".{domain}") for domain in OFFICIAL_SOURCE_DOMAINS)


def bump_patch(version):
    parts = str(version).split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise ProposalError(f"Cannot bump non-semver matrix version: {version}")
    parts[2] = str(int(parts[2]) + 1)
    return ".".join(parts)


def relative_label(path):
    try:
        return str(path.resolve().relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(path)


def find_capability(matrix, capability_name):
    for cap in matrix.get("capabilities", []):
        if cap.get("capability") == capability_name:
            return cap
    raise ProposalError(f"Unknown capability in proposal: {capability_name}")


def find_compliance_framework(matrix, framework_id):
    for framework in matrix.get("complianceFrameworks", []):
        if framework.get("id") == framework_id:
            return framework
    raise ProposalError(f"Unknown complianceFramework in proposal: {framework_id}")


def proposal_target_type(proposal):
    return proposal.get("targetType", "provider")


def require_approved(payload):
    meta = payload.get("_meta", {})
    if not isinstance(meta, dict) or meta.get("approved") is not True:
        raise ProposalError("Proposal file must have _meta.approved set to true before applying")


def validate_proposal_shape(proposal, index):
    required = [
        "field",
        "currentValue",
        "proposedValue",
        "sourceUrl",
        "sourceQuote",
        "rationale",
        "proposedOn",
    ]
    if not isinstance(proposal, dict):
        raise ProposalError(f"proposal[{index}] must be an object")
    for field in required:
        if field not in proposal:
            raise ProposalError(f"proposal[{index}] missing field: {field}")
    target_type = proposal_target_type(proposal)
    if target_type == "provider":
        for field in ["capability", "provider"]:
            if field not in proposal:
                raise ProposalError(f"proposal[{index}] missing field: {field}")
        if proposal["field"] not in PROVIDER_FIELDS:
            raise ProposalError(f"proposal[{index}] uses unsupported provider field: {proposal['field']}")
    elif target_type == "complianceFramework":
        if "frameworkId" not in proposal:
            raise ProposalError(f"proposal[{index}] missing field: frameworkId")
        if proposal["field"] not in COMPLIANCE_FRAMEWORK_FIELDS:
            raise ProposalError(f"proposal[{index}] uses unsupported complianceFramework field: {proposal['field']}")
    else:
        raise ProposalError(f"proposal[{index}] uses unsupported targetType: {target_type}")
    if not str(proposal.get("sourceUrl", "")).strip():
        raise ProposalError(f"proposal[{index}] is missing sourceUrl")
    validate_url(proposal.get("sourceUrl"), f"proposal[{index}].sourceUrl")
    if not is_official_source_url(proposal.get("sourceUrl")):
        raise ProposalError(f"proposal[{index}].sourceUrl is not an approved official primary source")
    try:
        date.fromisoformat(proposal.get("proposedOn", ""))
    except ValueError as exc:
        raise ProposalError(f"proposal[{index}].proposedOn must be YYYY-MM-DD") from exc
    if not str(proposal.get("sourceQuote", "")).strip():
        raise ProposalError(f"proposal[{index}].sourceQuote must not be empty")
    if len(str(proposal.get("sourceQuote", "")).split()) >= 15:
        raise ProposalError(f"proposal[{index}].sourceQuote must be under 15 words")
    if not str(proposal.get("rationale", "")).strip():
        raise ProposalError(f"proposal[{index}].rationale must not be empty")


def validate_proposed_value(proposal, index):
    field = proposal["field"]
    value = proposal.get("proposedValue")
    if field == "service" and not str(value or "").strip():
        raise ProposalError(f"proposal[{index}].proposedValue for service must not be empty")
    if field in ENUMS and value not in ENUMS[field]:
        raise ProposalError(f"proposal[{index}].proposedValue invalid for {field}: {value}")
    if field == "lastVerified":
        try:
            date.fromisoformat(value or "")
        except ValueError as exc:
            raise ProposalError(f"proposal[{index}].proposedValue for lastVerified must be YYYY-MM-DD") from exc
    if field == "region" and not str(value or "").strip():
        raise ProposalError(f"proposal[{index}].proposedValue for region must not be empty")
    if field == "parityDetail":
        validate_non_empty_string(value, f"proposal[{index}].proposedValue for parityDetail")
    if field == "constraints":
        validate_constraints(value, f"proposal[{index}].proposedValue for constraints")
    if field == "costModel":
        validate_cost_model(value, f"proposal[{index}].proposedValue for costModel")
    if field == "pqcReadiness":
        validate_pqc_readiness(value, f"proposal[{index}].proposedValue for pqcReadiness")
    if field == "fedramp":
        validate_fedramp(value, f"proposal[{index}].proposedValue for fedramp")
    if field in FACT_URL_FIELDS:
        validate_url(value, f"proposal[{index}].proposedValue")
    if field == "govVariant" and value is not None and not str(value).strip():
        raise ProposalError(f"proposal[{index}].proposedValue for govVariant must be non-empty or null")
    if field in {"dodImpactLevel", "sourceNotes"}:
        validate_non_empty_string(value, f"proposal[{index}].proposedValue for {field}")
    if field == "formerNames":
        if not isinstance(value, list) or not value:
            raise ProposalError(f"proposal[{index}].proposedValue for formerNames must be a non-empty array")
        if len(value) != len(set(value)) or any(not isinstance(item, str) or not item.strip() for item in value):
            raise ProposalError(f"proposal[{index}].proposedValue for formerNames must contain unique non-empty strings")


def append_source_note(provider, proposal):
    note = (
        f"{proposal['field']} verified {proposal['proposedOn']} from "
        f"{proposal['sourceUrl']}: {proposal['rationale']}"
    )
    existing = str(provider.get("sourceNotes", "")).strip()
    if note in existing:
        return
    provider["sourceNotes"] = f"{existing} {note}".strip()


def apply_payload(matrix, payload, source_label):
    require_approved(payload)
    proposals = payload.get("proposals", [])
    if not isinstance(proposals, list) or not proposals:
        raise ProposalError("Proposal file contains no proposals to apply")

    touched_records = {}
    touched_capabilities = {}
    for index, proposal in enumerate(proposals):
        validate_proposal_shape(proposal, index)
        validate_proposed_value(proposal, index)
        target_type = proposal_target_type(proposal)
        field = proposal["field"]
        if target_type == "provider":
            cap = find_capability(matrix, proposal["capability"])
            provider_key = proposal["provider"]
            provider = cap.get("providers", {}).get(provider_key)
            if provider is None:
                raise ProposalError(f"proposal[{index}] references missing provider: {provider_key}")

            current = provider.get(field)
            if current != proposal.get("currentValue"):
                raise ProposalError(
                    f"proposal[{index}] currentValue mismatch for "
                    f"{proposal['capability']}/{provider_key}/{field}: "
                    f"matrix has {current!r}, proposal has {proposal.get('currentValue')!r}"
                )

            if field == "govVariant" and proposal.get("proposedValue") is None:
                provider.pop(field, None)
            else:
                provider[field] = proposal.get("proposedValue")
            if field != "lastVerified":
                provider["lastVerified"] = proposal["proposedOn"]
            append_source_note(provider, proposal)
            touched_capabilities[(proposal["capability"], provider_key)] = proposal["proposedOn"]
            touched_records[(proposal["capability"], provider_key)] = proposal["proposedOn"]
        else:
            framework = find_compliance_framework(matrix, proposal["frameworkId"])
            current = framework.get(field)
            if current != proposal.get("currentValue"):
                raise ProposalError(
                    f"proposal[{index}] currentValue mismatch for "
                    f"complianceFrameworks/{proposal['frameworkId']}/{field}: "
                    f"matrix has {current!r}, proposal has {proposal.get('currentValue')!r}"
                )

            framework[field] = proposal.get("proposedValue")
            framework["lastVerified"] = proposal["proposedOn"]
            touched_records[(f"complianceFrameworks/{proposal['frameworkId']}", field)] = proposal["proposedOn"]

    for cap in matrix.get("capabilities", []):
        dates = [verified for (name, _), verified in touched_capabilities.items() if name == cap.get("capability")]
        if dates:
            cap["lastVerified"] = max(dates)

    matrix["_meta"]["version"] = bump_patch(matrix["_meta"].get("version", "0.0.0"))
    matrix["_meta"]["last_verified"] = max(touched_records.values())
    return {
        "proposalCount": len(proposals),
        "recordCount": len(touched_records),
        "date": max(touched_records.values()),
        "source": source_label,
        "version": matrix["_meta"]["version"],
    }


def append_changelog(path, summary):
    existing = path.read_text(encoding="utf-8") if path.exists() else "# Changelog\n\n---\n"
    marker = "---\n"
    entry = (
        f"\n## {summary['date']} - v{summary['version']} - Approved fact proposals\n"
        f"- Applied {summary['proposalCount']} approved fact proposal(s) from "
        f"`{summary['source']}` across {summary['recordCount']} record(s).\n"
    )
    if marker in existing:
        existing = existing.replace(marker, marker + entry, 1)
    else:
        existing = existing.rstrip() + "\n" + entry
    path.write_text(existing, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("proposal_file", help="Approved proposal JSON file")
    parser.add_argument("--matrix", default=str(DATA / "matrix.json"), help="Path to matrix.json")
    parser.add_argument("--changelog", default=str(DATA / "CHANGELOG.md"), help="Path to CHANGELOG.md")
    parser.add_argument("--dry-run", action="store_true", help="Validate and report without writing files")
    args = parser.parse_args()

    proposal_path = Path(args.proposal_file)
    matrix_path = Path(args.matrix)
    changelog_path = Path(args.changelog)
    payload = load_json(proposal_path)
    matrix = load_json(matrix_path)

    try:
        summary = apply_payload(matrix, payload, relative_label(proposal_path))
    except ProposalError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if args.dry_run:
        print(
            f"Validated {summary['proposalCount']} proposal(s) across "
            f"{summary['recordCount']} record(s); no files written."
        )
        return 0

    write_json(matrix_path, matrix)
    append_changelog(changelog_path, summary)
    print(
        f"Applied {summary['proposalCount']} proposal(s) across "
        f"{summary['recordCount']} record(s); matrix version is now {summary['version']}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
