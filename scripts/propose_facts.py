#!/usr/bin/env python3
"""Generate fact-proposal worklists without editing matrix.json."""

import argparse
import json
import sys
from datetime import date
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
DEFAULT_FIELDS = ["parityLag", "govAvailability", "linkFreshness"]
LINK_FIELDS = ["docsUrl", "pricingUrl", "complianceUrl", "govDocsUrl"]
SUPPORTED_FIELD_GROUPS = {
    "status",
    "govAvailability",
    "parityLag",
    "govVariant",
    "docsUrl",
    "pricingUrl",
    "complianceUrl",
    "govDocsUrl",
    "linkFreshness",
}
PROVIDER_SOURCE_HINTS = {
    "aws": [
        "https://docs.aws.amazon.com/govcloud-us/latest/UserGuide/",
        "https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/",
    ],
    "azure": [
        "https://learn.microsoft.com/en-us/azure/azure-government/",
        "https://azure.microsoft.com/en-us/explore/global-infrastructure/products-by-region/",
    ],
    "gcp": [
        "https://cloud.google.com/assured-workloads/docs",
        "https://cloud.google.com/about/locations",
    ],
    "oci": [
        "https://docs.oracle.com/en-us/iaas/Content/General/Concepts/govfedramp.htm",
    ],
}


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def parse_fields(values):
    if not values:
        return DEFAULT_FIELDS
    fields = []
    for value in values:
        for part in str(value).split(","):
            field = part.strip()
            if field:
                fields.append(field)
    return fields or DEFAULT_FIELDS


def target_fields_for(field_group):
    if field_group == "linkFreshness":
        return LINK_FIELDS
    return [field_group]


def provider_value(provider, field):
    return provider.get(field)


def is_stale(verified_date, stale_before):
    if not verified_date:
        return True
    try:
        return date.fromisoformat(verified_date) < stale_before
    except ValueError:
        return True


def reason_for_work_item(cap, provider, field, stale_before, field_group):
    current = provider_value(provider, field)
    if field_group == "linkFreshness":
        return "Review public link freshness; propose a URL change only when an official source supports it."
    if current == "Unknown":
        return "Current value is Unknown and needs official-source review."
    if is_stale(cap.get("lastVerified", ""), stale_before):
        return f"Capability lastVerified predates {stale_before.isoformat()} and needs official-source review."
    return None


def build_worklist(matrix, field_group, stale_days, generated_on):
    providers = matrix.get("_meta", {}).get("providers", [])
    stale_before = date.fromisoformat(generated_on).replace()
    stale_before = date.fromordinal(stale_before.toordinal() - stale_days)
    target_fields = target_fields_for(field_group)
    work_items = []
    seen = set()

    for cap in matrix.get("capabilities", []):
        for provider_key in providers:
            provider = cap.get("providers", {}).get(provider_key, {})
            for field in target_fields:
                reason = reason_for_work_item(cap, provider, field, stale_before, field_group)
                if not reason:
                    continue
                key = (cap.get("capability"), provider_key, field)
                if key in seen:
                    continue
                seen.add(key)
                item = {
                    "capability": cap.get("capability", ""),
                    "category": cap.get("category", ""),
                    "provider": provider_key,
                    "service": provider.get("service", ""),
                    "field": field,
                    "currentValue": provider_value(provider, field),
                    "docsUrl": provider.get("docsUrl"),
                    "govDocsUrl": provider.get("govDocsUrl"),
                    "reason": reason,
                }
                if field_group != "linkFreshness":
                    item["sourceHints"] = PROVIDER_SOURCE_HINTS.get(provider_key, [])
                    item["sourceNotes"] = " ".join(
                        part.strip()
                        for part in [cap.get("sourceNotes", ""), provider.get("sourceNotes", "")]
                        if part and part.strip()
                    )
                work_items.append(item)

    return {
        "_meta": {
            "schema": "cloudintel-proposals-v1",
            "description": "Review worklist for official-source fact proposals. Work items are not claims.",
            "generatedOn": generated_on,
            "approved": False,
            "targetFields": target_fields,
            "matrixVersion": matrix.get("_meta", {}).get("version", ""),
            "matrixLastVerified": matrix.get("_meta", {}).get("last_verified", ""),
            "sourceRule": "Only official primary sources are valid. Leave proposals empty when no source supports a change.",
        },
        "workItems": work_items,
        "proposals": [],
    }


def slug(value):
    return "".join(ch if ch.isalnum() else "-" for ch in value).strip("-")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--matrix", default=str(DATA / "matrix.json"), help="Path to matrix.json")
    parser.add_argument("--output-dir", default=str(DATA / "proposals"), help="Directory for generated proposal worklists")
    parser.add_argument("--fields", nargs="*", help="Fields or comma-separated field groups to review")
    parser.add_argument("--date", default=date.today().isoformat(), help="Proposal date in YYYY-MM-DD format")
    parser.add_argument("--stale-days", type=int, default=180, help="Also flag target fields when capability verification is older")
    args = parser.parse_args()

    try:
        date.fromisoformat(args.date)
    except ValueError:
        parser.error("--date must be YYYY-MM-DD")
    if args.stale_days < 1:
        parser.error("--stale-days must be positive")

    matrix = load_json(Path(args.matrix))
    output_dir = Path(args.output_dir)
    written = []

    for field_group in parse_fields(args.fields):
        if field_group not in SUPPORTED_FIELD_GROUPS:
            parser.error(f"unsupported field group: {field_group}")
        payload = build_worklist(matrix, field_group, args.stale_days, args.date)
        filename = f"{slug(field_group)}-{args.date}.json"
        path = output_dir / filename
        write_json(path, payload)
        written.append(path)

    print("Generated proposal worklist(s):")
    for path in written:
        print(f"- {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
