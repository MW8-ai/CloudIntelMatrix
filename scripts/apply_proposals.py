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
    "status",
    "govAvailability",
    "parityLag",
    "govVariant",
    "docsUrl",
    "pricingUrl",
    "complianceUrl",
    "govDocsUrl",
}
ENUMS = {
    "status": {"GA", "Preview", "Deprecated", "Retiring", "Unknown"},
    "govAvailability": {"Full", "Partial", "Limited", "None", "Unknown"},
    "parityLag": {"None", "Minor", "Moderate", "Significant", "Unknown"},
}
URL_FIELDS = {"docsUrl", "pricingUrl", "complianceUrl", "govDocsUrl"}
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


def require_approved(payload):
    meta = payload.get("_meta", {})
    if not isinstance(meta, dict) or meta.get("approved") is not True:
        raise ProposalError("Proposal file must have _meta.approved set to true before applying")


def validate_proposal_shape(proposal, index):
    required = [
        "capability",
        "provider",
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
    if proposal["field"] not in PROVIDER_FIELDS:
        raise ProposalError(f"proposal[{index}] uses unsupported field: {proposal['field']}")
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
    if field in ENUMS and value not in ENUMS[field]:
        raise ProposalError(f"proposal[{index}].proposedValue invalid for {field}: {value}")
    if field in URL_FIELDS:
        validate_url(value, f"proposal[{index}].proposedValue")
    if field == "govVariant" and value is not None and not str(value).strip():
        raise ProposalError(f"proposal[{index}].proposedValue for govVariant must be non-empty or null")


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

    touched = {}
    for index, proposal in enumerate(proposals):
        validate_proposal_shape(proposal, index)
        validate_proposed_value(proposal, index)
        cap = find_capability(matrix, proposal["capability"])
        provider_key = proposal["provider"]
        provider = cap.get("providers", {}).get(provider_key)
        if provider is None:
            raise ProposalError(f"proposal[{index}] references missing provider: {provider_key}")

        field = proposal["field"]
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
        append_source_note(provider, proposal)
        touched[(proposal["capability"], provider_key)] = proposal["proposedOn"]

    for cap in matrix.get("capabilities", []):
        dates = [verified for (name, _), verified in touched.items() if name == cap.get("capability")]
        if dates:
            cap["lastVerified"] = max(dates)

    matrix["_meta"]["version"] = bump_patch(matrix["_meta"].get("version", "0.0.0"))
    matrix["_meta"]["last_verified"] = max(touched.values())
    return {
        "proposalCount": len(proposals),
        "recordCount": len(touched),
        "date": max(touched.values()),
        "source": source_label,
        "version": matrix["_meta"]["version"],
    }


def append_changelog(path, summary):
    existing = path.read_text(encoding="utf-8") if path.exists() else "# Changelog\n\n---\n"
    marker = "---\n"
    entry = (
        f"\n## {summary['date']} - v{summary['version']} - Approved fact proposals\n"
        f"- Applied {summary['proposalCount']} approved fact proposal(s) from "
        f"`{summary['source']}` across {summary['recordCount']} capability/provider record(s).\n"
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
