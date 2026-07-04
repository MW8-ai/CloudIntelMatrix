#!/usr/bin/env python3
"""Additive ingester for optional provider objects.

Usage:
  python scripts/ingest_objects.py --field pqcReadiness --data verified_batch2_pqc.json --dry-run
  python scripts/ingest_objects.py --field fedramp --data fedramp_candidates.json --dry-run
  python scripts/ingest_objects.py --field residency --data residency_row20.json --dry-run

Input JSON:
  [{"capability": "<exact name>", "provider": "aws|azure|gcp|oci", "object": {...}}, ...]

For residency, `object` is an array of offering objects.

For field-specific bundles, the payload can also be under the field name:
  {"capability": "...", "provider": "aws", "fedramp": {...}}
"""

import argparse
import datetime
import json
import pathlib
import sys

MATRIX = pathlib.Path("data/matrix.json")
PROVIDERS = {"aws", "azure", "gcp", "oci"}
PQC_STATUS = {"GA", "Hybrid-Preview", "Roadmap", "None", "Unknown"}
PQC_PARITY = {"AtParity", "Lagging", "Unknown"}
CONFIDENCE = {"High", "Medium", "Low"}
FEDRAMP_STATUS = {"High", "Moderate", "Low", "None", "Unknown"}
FEDRAMP_IL = {"IL2", "IL4", "IL5", "IL6", "None", "Unknown"}
RESIDENCY_STATUS = {"GA", "Announced", "Preview", "Launching"}
VALIDATORS = {}


def add_error(errors, message):
    errors.append(message)


def validate_string(value, where, errors):
    if not isinstance(value, str) or not value.strip():
        add_error(errors, f"{where}: must be a non-empty string")


def validate_pqc(value, where, errors):
    if not isinstance(value, dict) or not value:
        add_error(errors, f"{where}: pqcReadiness must be a non-empty object")
        return
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
    extra = set(value) - allowed
    if extra:
        add_error(errors, f"{where}: unsupported pqcReadiness fields {sorted(extra)}")
    missing = required - set(value)
    if missing:
        add_error(errors, f"{where}: missing pqcReadiness fields {sorted(missing)}")
    if value.get("status") not in PQC_STATUS:
        add_error(errors, f"{where}: bad pqcReadiness.status {value.get('status')!r}")
    if value.get("fipsEndpointParity") not in PQC_PARITY:
        add_error(errors, f"{where}: bad pqcReadiness.fipsEndpointParity {value.get('fipsEndpointParity')!r}")
    if value.get("confidence") not in CONFIDENCE:
        add_error(errors, f"{where}: bad pqcReadiness.confidence {value.get('confidence')!r}")
    if "firstParty" in value and not isinstance(value.get("firstParty"), bool):
        add_error(errors, f"{where}: pqcReadiness.firstParty must be boolean")
    for field in ["kem", "signature", "tls", "vpn", "govPqc", "sourceDate", "note"]:
        if field in value:
            validate_string(value.get(field), f"{where}: pqcReadiness.{field}", errors)
    if "milestoneDate" in value and value.get("milestoneDate") is not None:
        validate_string(value.get("milestoneDate"), f"{where}: pqcReadiness.milestoneDate", errors)
    if value.get("status") != "Unknown":
        if not str(value.get("source", "")).startswith("https://"):
            add_error(errors, f"{where}: pqcReadiness.status {value.get('status')} requires an https source")
        if not value.get("sourceDate"):
            add_error(errors, f"{where}: pqcReadiness.status {value.get('status')} requires sourceDate")
    if value.get("firstParty") is False and not value.get("note"):
        add_error(errors, f"{where}: partner pqcReadiness entries must name the partner in note")


def validate_fedramp_environment(value, where, errors, government=False):
    if not isinstance(value, dict):
        add_error(errors, f"{where}: must be an object")
        return
    allowed = {"status", "url", "date", "confidence", "note"}
    if government:
        allowed |= {"dodIL", "boundary"}
    extra = set(value) - allowed
    if extra:
        add_error(errors, f"{where}: unsupported fields {sorted(extra)}")
    status = value.get("status")
    if status not in FEDRAMP_STATUS:
        add_error(errors, f"{where}: bad status {status!r}")
    if value.get("confidence") not in CONFIDENCE:
        add_error(errors, f"{where}: bad confidence {value.get('confidence')!r}")
    if status in {"High", "Moderate", "Low"}:
        if not str(value.get("url", "")).startswith("https://"):
            add_error(errors, f"{where}: status {status} requires an https url")
        if not value.get("date"):
            add_error(errors, f"{where}: status {status} requires date")
    if government:
        dod_il = value.get("dodIL")
        if dod_il not in FEDRAMP_IL:
            add_error(errors, f"{where}: bad dodIL {dod_il!r}")
        if dod_il in {"IL4", "IL5", "IL6"} and status not in {"High", "Moderate"}:
            add_error(errors, f"{where}: dodIL {dod_il} requires High or Moderate government status")


def validate_fedramp(value, where, errors):
    if not isinstance(value, dict) or not value:
        add_error(errors, f"{where}: fedramp must be a non-empty object")
        return
    extra = set(value) - {"commercial", "government"}
    if extra:
        add_error(errors, f"{where}: unsupported fedramp fields {sorted(extra)}")
    for env in ["commercial", "government"]:
        if env not in value:
            add_error(errors, f"{where}: missing fedramp.{env}")
    if "commercial" in value:
        validate_fedramp_environment(value.get("commercial"), f"{where}: fedramp.commercial", errors)
    if "government" in value:
        validate_fedramp_environment(value.get("government"), f"{where}: fedramp.government", errors, government=True)


def validate_residency(value, where, errors):
    if not isinstance(value, list) or not value:
        add_error(errors, f"{where}: residency must be a non-empty array")
        return
    required = {"offering", "guarantee", "geography", "status", "source", "firstParty"}
    for index, item in enumerate(value):
        item_where = f"{where}: residency[{index}]"
        if not isinstance(item, dict):
            add_error(errors, f"{item_where}: must be an object")
            continue
        extra = set(item) - required
        if extra:
            add_error(errors, f"{item_where}: unsupported fields {sorted(extra)}")
        missing = required - set(item)
        if missing:
            add_error(errors, f"{item_where}: missing fields {sorted(missing)}")
        for field in ["offering", "guarantee", "geography"]:
            validate_string(item.get(field), f"{item_where}.{field}", errors)
        if item.get("status") not in RESIDENCY_STATUS:
            add_error(errors, f"{item_where}: bad status {item.get('status')!r}")
        if not str(item.get("source", "")).startswith("https://"):
            add_error(errors, f"{item_where}: source must be an https URL")
        if not isinstance(item.get("firstParty"), bool):
            add_error(errors, f"{item_where}: firstParty must be boolean")


VALIDATORS["pqcReadiness"] = validate_pqc
VALIDATORS["fedramp"] = validate_fedramp
VALIDATORS["residency"] = validate_residency


def next_minor_version(version):
    parts = str(version or "0.0.0").split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        return version
    major, minor, _patch = (int(part) for part in parts)
    return f"{major}.{minor + 1}.0"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--field", required=True, choices=sorted(VALIDATORS))
    parser.add_argument("--data", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
    rows = json.loads(pathlib.Path(args.data).read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        print("VALIDATION FAILED: input JSON must be a list", file=sys.stderr)
        sys.exit(1)

    by_name = {
        capability.get("capability"): capability
        for capability in matrix.get("capabilities", [])
        if isinstance(capability, dict)
    }
    errors = []
    staged = []
    for index, row in enumerate(rows):
        where = f"row {index} ({row.get('capability')}/{row.get('provider')})"
        capability = by_name.get(row.get("capability"))
        if not capability:
            add_error(errors, f"{where}: capability not found")
            continue
        provider_key = row.get("provider")
        if provider_key not in PROVIDERS:
            add_error(errors, f"{where}: provider must be one of {sorted(PROVIDERS)}")
            continue
        provider = capability.get("providers", {}).get(provider_key)
        if not isinstance(provider, dict):
            add_error(errors, f"{where}: provider block missing")
            continue
        obj = row.get("object")
        if obj is None:
            obj = row.get(args.field)
        if args.field == "residency":
            valid_payload = isinstance(obj, list)
        else:
            valid_payload = isinstance(obj, dict)
        if not valid_payload:
            add_error(errors, f"{where}: no object/{args.field} payload found")
            continue
        VALIDATORS[args.field](obj, where, errors)
        staged.append((capability, provider, obj))

    if errors:
        print("VALIDATION FAILED, no changes written:")
        for error in errors:
            print(f"  - {error}")
        sys.exit(1)

    verified_on = datetime.date.today().isoformat()
    matrix["_meta"]["version"] = next_minor_version(matrix.get("_meta", {}).get("version"))
    matrix["_meta"]["last_verified"] = verified_on
    if args.dry_run:
        print(f"DRY RUN ok: would write {len(staged)} {args.field} object(s)")
        print(f"Version would become {matrix['_meta']['version']}")
        print(f"last_verified would become {matrix['_meta']['last_verified']}")
        return

    touched_capabilities = set()
    for capability, provider, obj in staged:
        provider[args.field] = obj
        provider["lastVerified"] = verified_on
        touched_capabilities.add(capability.get("capability"))
    for capability in matrix.get("capabilities", []):
        if capability.get("capability") in touched_capabilities:
            capability["lastVerified"] = verified_on

    MATRIX.write_text(json.dumps(matrix, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(staged)} {args.field} object(s)")
    print(f"Version -> {matrix['_meta']['version']}")
    print(f"last_verified -> {matrix['_meta']['last_verified']}")


if __name__ == "__main__":
    main()
