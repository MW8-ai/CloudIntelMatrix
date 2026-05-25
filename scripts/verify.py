#!/usr/bin/env python3
"""Validate Cloud Intelligence Matrix data and optionally check public links."""

import argparse
import json
import socket
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"
EXPECTED_PROVIDERS = ["aws", "azure", "gcp"]
CLASSIFICATION_TAGS = {"STANDARD", "AI_CAPABLE", "AI_NATIVE"}
VALID_GOV = {"Full", "Partial", "Limited", "None", "Unknown"}
VALID_PARITY = {"None", "Minor", "Moderate", "Significant", "Unknown"}
VALID_STATUS = {"GA", "Preview", "Deprecated", "Retiring", "Unknown"}
VALID_USTATUS = {"preview", "announced", "ga", "limited", "deprecated"}
VALID_UTYPE = {"expansion", "new_region", "new_feature", "feature_ga", "new_instance", "deprecation_notice"}
CAP_REQUIRED = [
    "capability",
    "category",
    "tags",
    "aiClassification",
    "architectureNotes",
    "operationalConsiderations",
    "lastVerified",
    "providers",
]
CAP_ALLOWED = set(CAP_REQUIRED + ["sourceNotes"])
FRAMEWORK_REQUIRED = ["framework", "frameworkUrl", "foundation", "foundationUrl", "lastVerified"]
FRAMEWORK_ALLOWED = set(FRAMEWORK_REQUIRED)
CONTROL_LENS_REQUIRED = ["id", "name", "release", "catalogUrl", "baselineUrl", "oscalUrl", "scopeNote", "lastVerified", "families"]
CONTROL_LENS_ALLOWED = set(CONTROL_LENS_REQUIRED)
CONTROL_FAMILY_REQUIRED = ["id", "name", "applicability", "capabilities", "reviewPrompts"]
CONTROL_FAMILY_ALLOWED = set(CONTROL_FAMILY_REQUIRED)
PATTERN_REQUIRED = [
    "id",
    "name",
    "summary",
    "whenToUse",
    "capabilities",
    "reviewPrompts",
    "verificationNote",
    "lastVerified",
]
PATTERN_ALLOWED = set(PATTERN_REQUIRED)
PROV_REQUIRED = [
    "service",
    "status",
    "govAvailability",
    "parityLag",
    "docsUrl",
    "pricingUrl",
    "complianceUrl",
    "tierNotes",
]
PROV_ALLOWED = set(PROV_REQUIRED + ["govVariant", "govDocsUrl", "sourceNotes"])

ERRORS = []
WARNINGS = []
INFO = []
AZURE_PRICING_TIMEOUT_LIMIT = 2


def err(message):
    ERRORS.append(f"ERROR: {message}")


def warn(message):
    WARNINGS.append(f"WARN: {message}")


def info(message):
    INFO.append(f"INFO: {message}")


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        err(f"Missing: {path.relative_to(ROOT)}")
    except json.JSONDecodeError as exc:
        err(f"Bad JSON in {path.name}: {exc}")
    return None


def require_fields(value, fields, label):
    if not isinstance(value, dict):
        err(f"{label} must be an object")
        return
    for field in fields:
        if field not in value:
            err(f"{label} missing field: {field}")


def validate_date(value, label):
    try:
        date.fromisoformat(value)
    except (TypeError, ValueError):
        err(f"{label} must be an ISO date (YYYY-MM-DD)")


def validate_url(value, label, notes_available):
    if value is None:
        if not notes_available:
            err(f"{label} is unavailable; add sourceNotes explaining why")
        return
    if not isinstance(value, str) or not value.strip():
        err(f"{label} must be a URL or null with sourceNotes")
        return
    parsed = urlparse(value)
    if parsed.scheme not in {"https", "http"} or not parsed.netloc:
        err(f"{label} must be a public HTTP(S) URL: {value}")


def validate_schema_contract(schema):
    if not isinstance(schema, dict):
        return
    if schema.get("$schema") != "https://json-schema.org/draft/2020-12/schema":
        err("data/schema.json must declare JSON Schema draft 2020-12")
    capability = schema.get("$defs", {}).get("capability", {})
    provider = schema.get("$defs", {}).get("provider", {})
    framework = schema.get("$defs", {}).get("framework", {})
    control_lens = schema.get("$defs", {}).get("controlLens", {})
    control_family = schema.get("$defs", {}).get("controlFamily", {})
    pattern = schema.get("$defs", {}).get("pattern", {})
    required_caps = set(capability.get("required", []))
    required_prov = set(provider.get("required", []))
    required_framework = set(framework.get("required", []))
    required_control_lens = set(control_lens.get("required", []))
    required_control_family = set(control_family.get("required", []))
    required_pattern = set(pattern.get("required", []))
    required_root = set(schema.get("required", []))
    if not {"frameworks", "controlLens", "patterns"}.issubset(required_root):
        err("data/schema.json root requirements must include frameworks, controlLens, and patterns")
    if not set(CAP_REQUIRED).issubset(required_caps):
        err("data/schema.json capability requirements do not cover validator-required fields")
    if not set(PROV_REQUIRED).issubset(required_prov):
        err("data/schema.json provider requirements do not cover validator-required fields")
    if not set(FRAMEWORK_REQUIRED).issubset(required_framework):
        err("data/schema.json framework requirements do not cover validator-required fields")
    if not set(CONTROL_LENS_REQUIRED).issubset(required_control_lens):
        err("data/schema.json controlLens requirements do not cover validator-required fields")
    if not set(CONTROL_FAMILY_REQUIRED).issubset(required_control_family):
        err("data/schema.json controlFamily requirements do not cover validator-required fields")
    if not set(PATTERN_REQUIRED).issubset(required_pattern):
        err("data/schema.json pattern requirements do not cover validator-required fields")
    info("data/schema.json: capability-v1 contract loaded")


def validate_matrix(mdata):
    require_fields(mdata, ["_meta", "tags", "categories", "frameworks", "controlLens", "patterns", "capabilities"], "matrix.json")
    if not isinstance(mdata, dict):
        return None, [], [], {}, {}

    meta = mdata.get("_meta", {})
    require_fields(meta, ["version", "schema", "last_verified", "providers", "tiers", "license", "repo"], "_meta")
    if meta.get("schema") != "capability-v1":
        err(f"_meta.schema must be capability-v1, got: {meta.get('schema')}")
    validate_date(meta.get("last_verified"), "_meta.last_verified")
    validate_url(meta.get("repo"), "_meta.repo", False)

    providers = meta.get("providers", [])
    if providers != EXPECTED_PROVIDERS:
        err(f"_meta.providers must be exactly: {EXPECTED_PROVIDERS}")
        providers = EXPECTED_PROVIDERS

    tiers = meta.get("tiers", [])
    if not isinstance(tiers, list) or not tiers:
        err("_meta.tiers must be a non-empty array")
        tiers = []

    categories = mdata.get("categories", [])
    if not isinstance(categories, list) or not categories:
        err("categories must be a non-empty array")
        categories = []
    elif len(categories) != len(set(categories)):
        err("categories contains duplicates")

    tag_defs = mdata.get("tags", {})
    if not isinstance(tag_defs, dict) or not tag_defs:
        err("tags must be a non-empty object")
        tag_defs = {}
    for tag_key, definition in tag_defs.items():
        require_fields(definition, ["label", "color", "description"], f"tag '{tag_key}'")

    frameworks = mdata.get("frameworks", {})
    if not isinstance(frameworks, dict):
        err("frameworks must be an object")
        frameworks = {}
    for pkey in EXPECTED_PROVIDERS:
        guidance = frameworks.get(pkey)
        if not guidance:
            err(f"frameworks missing provider: {pkey}")
            continue
        require_fields(guidance, FRAMEWORK_REQUIRED, f"framework '{pkey}'")
        unexpected_framework_fields = set(guidance) - FRAMEWORK_ALLOWED
        if unexpected_framework_fields:
            err(f"framework '{pkey}' contains unsupported fields: {sorted(unexpected_framework_fields)}")
        validate_url(guidance.get("frameworkUrl"), f"framework '{pkey}'.frameworkUrl", False)
        validate_url(guidance.get("foundationUrl"), f"framework '{pkey}'.foundationUrl", False)
        validate_date(guidance.get("lastVerified"), f"framework '{pkey}'.lastVerified")
    extra_frameworks = set(frameworks) - set(EXPECTED_PROVIDERS)
    if extra_frameworks:
        err(f"frameworks contains unsupported providers: {sorted(extra_frameworks)}")

    capabilities = mdata.get("capabilities", [])
    if not isinstance(capabilities, list) or not capabilities:
        err("capabilities must be a non-empty array")
        capabilities = []

    seen_caps = set()
    for cap in capabilities:
        name = cap.get("capability", "MISSING") if isinstance(cap, dict) else "MISSING"
        require_fields(cap, CAP_REQUIRED, f"capability '{name}'")
        if not isinstance(cap, dict):
            continue
        unexpected_cap_fields = set(cap) - CAP_ALLOWED
        if unexpected_cap_fields:
            err(f"'{name}' contains unsupported fields: {sorted(unexpected_cap_fields)}")
        if name in seen_caps:
            err(f"Duplicate capability: '{name}'")
        seen_caps.add(name)
        if cap.get("category") not in categories:
            err(f"'{name}' category '{cap.get('category')}' not in categories list")
        validate_date(cap.get("lastVerified"), f"'{name}'.lastVerified")

        tags = cap.get("tags", [])
        if not isinstance(tags, list) or not tags:
            err(f"'{name}'.tags must be a non-empty array")
            tags = []
        elif len(tags) != len(set(tags)):
            err(f"'{name}'.tags contains duplicates")
        for tag in tags:
            if tag not in tag_defs:
                err(f"'{name}' unknown tag: {tag}")

        classification = cap.get("aiClassification")
        if classification not in CLASSIFICATION_TAGS:
            err(f"'{name}' invalid aiClassification: {classification}")
        elif classification not in tags:
            err(f"'{name}' aiClassification '{classification}' must also appear in tags")

        cap_notes = bool(cap.get("sourceNotes"))
        capability_providers = cap.get("providers", {})
        if not isinstance(capability_providers, dict):
            err(f"'{name}'.providers must be an object")
            continue
        extra_providers = set(capability_providers) - set(EXPECTED_PROVIDERS)
        if extra_providers:
            err(f"'{name}' contains unsupported providers: {sorted(extra_providers)}")

        for pkey in EXPECTED_PROVIDERS:
            provider = capability_providers.get(pkey)
            if not provider:
                err(f"'{name}' missing provider: {pkey}")
                continue
            require_fields(provider, PROV_REQUIRED, f"'{name}/{pkey}'")
            unexpected_provider_fields = set(provider) - PROV_ALLOWED
            if unexpected_provider_fields:
                err(f"'{name}/{pkey}' contains unsupported fields: {sorted(unexpected_provider_fields)}")
            notes_available = cap_notes or bool(provider.get("sourceNotes"))

            if provider.get("status") not in VALID_STATUS:
                err(f"'{name}/{pkey}' invalid status: {provider.get('status')}")
            if provider.get("govAvailability") not in VALID_GOV:
                err(f"'{name}/{pkey}' invalid govAvailability: {provider.get('govAvailability')}")
            if provider.get("parityLag") not in VALID_PARITY:
                err(f"'{name}/{pkey}' invalid parityLag: {provider.get('parityLag')}")
            if any(provider.get(field) == "Unknown" for field in ["status", "govAvailability", "parityLag"]) and not notes_available:
                err(f"'{name}/{pkey}' has Unknown facts without sourceNotes")

            for field in ["docsUrl", "pricingUrl", "complianceUrl"]:
                validate_url(provider.get(field), f"'{name}/{pkey}'.{field}", notes_available)
            if "govDocsUrl" in provider:
                validate_url(provider.get("govDocsUrl"), f"'{name}/{pkey}'.govDocsUrl", notes_available)

            tier_notes = provider.get("tierNotes", {})
            if not isinstance(tier_notes, dict):
                err(f"'{name}/{pkey}'.tierNotes must be an object")
                continue
            for tier in tiers:
                if tier not in tier_notes:
                    err(f"'{name}/{pkey}' missing tierNotes for: {tier}")

    control_lens = mdata.get("controlLens", {})
    require_fields(control_lens, CONTROL_LENS_REQUIRED, "controlLens")
    if not isinstance(control_lens, dict):
        control_lens = {}
    else:
        unexpected_lens_fields = set(control_lens) - CONTROL_LENS_ALLOWED
        if unexpected_lens_fields:
            err(f"controlLens contains unsupported fields: {sorted(unexpected_lens_fields)}")
        for field in ["catalogUrl", "baselineUrl", "oscalUrl"]:
            validate_url(control_lens.get(field), f"controlLens.{field}", False)
        validate_date(control_lens.get("lastVerified"), "controlLens.lastVerified")
        families = control_lens.get("families", [])
        if not isinstance(families, list) or not families:
            err("controlLens.families must be a non-empty array")
            families = []
        seen_families = set()
        for family in families:
            family_id = family.get("id", "MISSING") if isinstance(family, dict) else "MISSING"
            require_fields(family, CONTROL_FAMILY_REQUIRED, f"control family '{family_id}'")
            if not isinstance(family, dict):
                continue
            unexpected_family_fields = set(family) - CONTROL_FAMILY_ALLOWED
            if unexpected_family_fields:
                err(f"control family '{family_id}' contains unsupported fields: {sorted(unexpected_family_fields)}")
            if family_id in seen_families:
                err(f"Duplicate control family: '{family_id}'")
            seen_families.add(family_id)
            refs = family.get("capabilities", [])
            if not isinstance(refs, list) or not refs:
                err(f"control family '{family_id}'.capabilities must be a non-empty array")
            elif len(refs) != len(set(refs)):
                err(f"control family '{family_id}'.capabilities contains duplicates")
            else:
                for capability_name in refs:
                    if capability_name not in seen_caps:
                        err(f"control family '{family_id}' references unknown capability: {capability_name}")
            prompts = family.get("reviewPrompts", [])
            if not isinstance(prompts, list) or not prompts:
                err(f"control family '{family_id}'.reviewPrompts must be a non-empty array")
        info(f"controlLens: {control_lens.get('name', 'unknown')}; {len(families)} selected families")

    patterns = mdata.get("patterns", [])
    if not isinstance(patterns, list) or not patterns:
        err("patterns must be a non-empty array")
        patterns = []
    seen_patterns = set()
    for pattern in patterns:
        pattern_id = pattern.get("id", "MISSING") if isinstance(pattern, dict) else "MISSING"
        require_fields(pattern, PATTERN_REQUIRED, f"pattern '{pattern_id}'")
        if not isinstance(pattern, dict):
            continue
        unexpected_pattern_fields = set(pattern) - PATTERN_ALLOWED
        if unexpected_pattern_fields:
            err(f"pattern '{pattern_id}' contains unsupported fields: {sorted(unexpected_pattern_fields)}")
        if pattern_id in seen_patterns:
            err(f"Duplicate pattern: '{pattern_id}'")
        seen_patterns.add(pattern_id)
        validate_date(pattern.get("lastVerified"), f"pattern '{pattern_id}'.lastVerified")
        refs = pattern.get("capabilities", [])
        if not isinstance(refs, list) or not refs:
            err(f"pattern '{pattern_id}'.capabilities must be a non-empty array")
        elif len(refs) != len(set(refs)):
            err(f"pattern '{pattern_id}'.capabilities contains duplicates")
        else:
            for capability_name in refs:
                if capability_name not in seen_caps:
                    err(f"pattern '{pattern_id}' references unknown capability: {capability_name}")
        prompts = pattern.get("reviewPrompts", [])
        if not isinstance(prompts, list) or not prompts:
            err(f"pattern '{pattern_id}'.reviewPrompts must be a non-empty array")

    info(
        f"matrix.json: {len(capabilities)} capabilities; {len(patterns)} patterns; "
        f"{len(providers)} providers; schema {meta.get('schema')}"
    )
    return providers, capabilities, tiers, frameworks, control_lens


def validate_upcoming(udata):
    if not isinstance(udata, dict):
        return []
    items = udata.get("upcoming", [])
    if not isinstance(items, list):
        err("upcoming.json.upcoming must be an array")
        return []
    seen_ids = set()
    for item in items:
        item_id = item.get("id", "MISSING") if isinstance(item, dict) else "MISSING"
        require_fields(item, ["id", "provider", "category", "title", "detail", "status", "source"], f"upcoming '{item_id}'")
        if not isinstance(item, dict):
            continue
        if item_id in seen_ids:
            err(f"Duplicate upcoming id: {item_id}")
        seen_ids.add(item_id)
        if item.get("status") not in VALID_USTATUS:
            err(f"upcoming '{item_id}' invalid status: {item.get('status')}")
        if "type" in item and item.get("type") not in VALID_UTYPE:
            err(f"upcoming '{item_id}' invalid type: {item.get('type')}")
        if item.get("status") == "ga":
            warn(f"upcoming '{item_id}' status=ga; promote to matrix.json and remove")
        expected_ga = item.get("expected_ga")
        if expected_ga and len(str(expected_ga)) == 4 and int(expected_ga) < date.today().year:
            warn(f"upcoming '{item_id}' expected_ga={expected_ga} is past; verify or remove")
        validate_url(item.get("source"), f"upcoming '{item_id}'.source", False)
    info(f"upcoming.json: {len(items)} items")
    return items


def is_timeout_error(exc):
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return True
    if isinstance(exc, urllib.error.URLError) and isinstance(exc.reason, (TimeoutError, socket.timeout)):
        return True
    return "timed out" in str(exc).lower()


def is_azure_pricing_url(url):
    parsed = urlparse(url)
    return parsed.netloc.lower() == "azure.microsoft.com" and "/pricing" in parsed.path.lower()


def check_link(url, label, defer_timeout_warning=False):
    if not url:
        return None
    try:
        request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "CloudIntelMatrix-verify/3.0"})
        with urllib.request.urlopen(request, timeout=10) as response:
            if response.status >= 400:
                warn(f"HTTP {response.status}: {label} - {url}")
    except urllib.error.HTTPError as exc:
        if exc.code not in (403, 405):
            warn(f"HTTP {exc.code}: {label} - {url}")
    except Exception as exc:
        if defer_timeout_warning and is_timeout_error(exc):
            return "timeout"
        warn(f"Could not verify {label}: {exc}")
    return None


def run_link_checks(capabilities, upcoming, frameworks, control_lens):
    print("Checking source URLs (non-blocking)...")
    links = {}
    azure_pricing_timeouts = []
    azure_pricing_skipped = []

    def add_link(url, label):
        if url:
            links.setdefault(url, []).append(label)

    for cap in capabilities:
        for pkey in EXPECTED_PROVIDERS:
            provider = cap.get("providers", {}).get(pkey, {})
            for field in ["docsUrl", "pricingUrl", "complianceUrl", "govDocsUrl"]:
                add_link(provider.get(field), f"{cap.get('capability', '?')}/{pkey}/{field}")
    for item in upcoming:
        add_link(item.get("source"), f"upcoming/{item.get('id')}")
    for pkey, guidance in frameworks.items():
        for field in ["frameworkUrl", "foundationUrl"]:
            add_link(guidance.get(field), f"framework/{pkey}/{field}")
    for field in ["catalogUrl", "baselineUrl", "oscalUrl"]:
        add_link(control_lens.get(field), f"controlLens/{field}")

    info(
        f"public link review: {sum(len(labels) for labels in links.values())} references; "
        f"{len(links)} distinct URLs checked"
    )
    for url, labels in links.items():
        label = labels[0]
        if len(labels) > 1:
            label += f" (+{len(labels) - 1} additional reference(s))"
        if is_azure_pricing_url(url):
            if len(azure_pricing_timeouts) >= AZURE_PRICING_TIMEOUT_LIMIT:
                azure_pricing_skipped.append(label)
                continue
            if check_link(url, label, defer_timeout_warning=True) == "timeout":
                azure_pricing_timeouts.append(label)
        else:
            check_link(url, label)
        time.sleep(0.2)

    if azure_pricing_timeouts or azure_pricing_skipped:
        warn(
            "Azure pricing link review remains unverified for this run: "
            f"{len(azure_pricing_timeouts)} distinct URL(s) timed out and "
            f"{len(azure_pricing_skipped)} additional URL(s) were skipped "
            "after repeated timeouts."
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--schema-only", action="store_true", help="Validate data/matrix.json against the capability contract only.")
    parser.add_argument("--check-links", action="store_true", help="Also check public source URLs; network failures are warnings.")
    args = parser.parse_args()
    if args.schema_only and args.check_links:
        parser.error("--schema-only cannot be combined with --check-links")

    schema = load(DATA / "schema.json")
    matrix = load(DATA / "matrix.json")
    if schema is None or matrix is None:
        print("\n".join(ERRORS))
        return 1
    validate_schema_contract(schema)
    providers, capabilities, _, frameworks, control_lens = validate_matrix(matrix)

    upcoming = []
    if not args.schema_only:
        upcoming_data = load(DATA / "upcoming.json")
        sources_data = load(DATA / "sources.json")
        if upcoming_data is None or sources_data is None:
            print("\n".join(ERRORS))
            return 1
        upcoming = validate_upcoming(upcoming_data)
        if isinstance(sources_data, dict):
            info("sources.json: loaded")

    if args.check_links and not ERRORS:
        run_link_checks(capabilities, upcoming, frameworks, control_lens)

    print("\n" + "=" * 60)
    print("CLOUD INTELLIGENCE MATRIX - VERIFICATION REPORT")
    print("=" * 60)
    for message in INFO:
        print(f"  {message}")
    if WARNINGS:
        print(f"\nWarnings ({len(WARNINGS)}):")
        for message in WARNINGS:
            print(f"  {message}")
    if ERRORS:
        print(f"\nErrors ({len(ERRORS)}):")
        for message in ERRORS:
            print(f"  {message}")
        print(f"\nResult: FAILED - {len(ERRORS)} error(s)")
        return 1
    print(f"\nPASSED - 0 errors; {len(WARNINGS)} warnings")
    return 0


if __name__ == "__main__":
    sys.exit(main())
