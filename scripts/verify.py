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
EXPECTED_PROVIDERS = ["aws", "azure", "gcp", "oci"]
CLASSIFICATION_TAGS = {"STANDARD", "AI_CAPABLE", "AI_NATIVE"}
VALID_GOV = {"Full", "Partial", "Limited", "None", "Unknown"}
VALID_PARITY = {"None", "Minor", "Moderate", "Significant", "Unknown"}
VALID_STATUS = {"GA", "Preview", "Deprecated", "Retiring", "Unknown"}
VALID_REALM_CLASS = {"commercial", "us-gov", "eu-sovereign", "other-sovereign"}
VALID_USTATUS = {"preview", "announced", "ga", "limited", "deprecated"}
VALID_UTYPE = {"expansion", "new_region", "new_feature", "feature_ga", "new_instance", "deprecation_notice"}
VALID_HISTORY_PHASE = {"Commercial cloud", "Personal / Free", "Government state/federal"}
VALID_TRANSPARENCY_STATUS = {"Active", "Proposed", "Repealed", "None on record", "Unknown"}
EXPECTED_STATES = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District of Columbia",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
}
RECOGNIZED_STATE_DOMAINS = {
    "myflorida.com",
}
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
COMPLIANCE_KIND = {"authorization-program", "regulation", "validation-standard", "voluntary-framework"}
COMPLIANCE_STATUS = {"Active", "Draft", "In development", "Superseded"}
COMPLIANCE_REQUIRED = ["id", "name", "issuer", "kind", "scope", "status", "url", "nistAlignment", "lastVerified"]
COMPLIANCE_ALLOWED = set(COMPLIANCE_REQUIRED + ["historicalNote"])
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
HISTORY_REQUIRED = [
    "id",
    "provider",
    "phase",
    "year",
    "date",
    "dateLabel",
    "title",
    "summary",
    "scope",
    "sourceLabel",
    "sourceUrl",
]
HISTORY_ALLOWED = set(HISTORY_REQUIRED)
TRANSPARENCY_REQUIRED = [
    "state",
    "stateName",
    "instrument",
    "title",
    "citation",
    "status",
    "summary",
    "url",
    "lastVerified",
]
TRANSPARENCY_ALLOWED = set(TRANSPARENCY_REQUIRED)
PROPOSAL_PROVIDER_FIELDS = {
    "service",
    "status",
    "govAvailability",
    "parityLag",
    "govVariant",
    "region",
    "realmClass",
    "lastVerified",
    "formerNames",
    "docsUrl",
    "pricingUrl",
    "complianceUrl",
    "govDocsUrl",
}
PROPOSAL_URL_FIELDS = {"docsUrl", "pricingUrl", "complianceUrl", "govDocsUrl"}
PROPOSAL_COMPLIANCE_FRAMEWORK_FIELDS = {"url"}
PROPOSAL_FACT_URL_FIELDS = PROPOSAL_URL_FIELDS | PROPOSAL_COMPLIANCE_FRAMEWORK_FIELDS
PROPOSAL_COMMON_REQUIRED = [
    "field",
    "currentValue",
    "proposedValue",
    "sourceUrl",
    "sourceQuote",
    "rationale",
    "proposedOn",
]
PROPOSAL_PROVIDER_REQUIRED = ["capability", "provider"]
PROPOSAL_COMPLIANCE_FRAMEWORK_REQUIRED = ["targetType", "frameworkId"]
PROPOSAL_ALLOWED = set(PROPOSAL_COMMON_REQUIRED + PROPOSAL_PROVIDER_REQUIRED + PROPOSAL_COMPLIANCE_FRAMEWORK_REQUIRED)
PROPOSAL_WORK_ITEM_COMMON_REQUIRED = ["field", "currentValue", "reason"]
PROPOSAL_WORK_ITEM_PROVIDER_REQUIRED = ["capability", "provider"]
PROPOSAL_WORK_ITEM_COMPLIANCE_FRAMEWORK_REQUIRED = ["targetType", "frameworkId"]
PROPOSAL_WORK_ITEM_ALLOWED = set(
    PROPOSAL_WORK_ITEM_COMMON_REQUIRED
    + PROPOSAL_WORK_ITEM_PROVIDER_REQUIRED
    + PROPOSAL_WORK_ITEM_COMPLIANCE_FRAMEWORK_REQUIRED
    + ["category", "service", "docsUrl", "govDocsUrl", "sourceNotes", "sourceHints"]
)
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
PROV_ALLOWED = set(PROV_REQUIRED + ["formerNames", "govVariant", "region", "realmClass", "lastVerified", "govDocsUrl", "sourceNotes"])

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
    compliance_framework = schema.get("$defs", {}).get("complianceFramework", {})
    pattern = schema.get("$defs", {}).get("pattern", {})
    required_caps = set(capability.get("required", []))
    required_prov = set(provider.get("required", []))
    required_framework = set(framework.get("required", []))
    required_control_lens = set(control_lens.get("required", []))
    required_control_family = set(control_family.get("required", []))
    required_compliance_framework = set(compliance_framework.get("required", []))
    required_pattern = set(pattern.get("required", []))
    required_root = set(schema.get("required", []))
    if not {"frameworks", "controlLens", "complianceFrameworks", "patterns"}.issubset(required_root):
        err("data/schema.json root requirements must include frameworks, controlLens, complianceFrameworks, and patterns")
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
    if not set(COMPLIANCE_REQUIRED).issubset(required_compliance_framework):
        err("data/schema.json complianceFramework requirements do not cover validator-required fields")
    if not set(PATTERN_REQUIRED).issubset(required_pattern):
        err("data/schema.json pattern requirements do not cover validator-required fields")
    info("data/schema.json: capability-v1 contract loaded")


def validate_matrix(mdata):
    require_fields(mdata, ["_meta", "tags", "categories", "frameworks", "controlLens", "complianceFrameworks", "patterns", "capabilities"], "matrix.json")
    if not isinstance(mdata, dict):
        return None, [], [], {}, {}, []

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
            if "lastVerified" in provider:
                validate_date(provider.get("lastVerified"), f"'{name}/{pkey}'.lastVerified")
            if "region" in provider and not str(provider.get("region", "")).strip():
                err(f"'{name}/{pkey}'.region must be a non-empty string when present")
            if "realmClass" in provider and provider.get("realmClass") not in VALID_REALM_CLASS:
                err(f"'{name}/{pkey}' invalid realmClass: {provider.get('realmClass')}")

            for field in ["docsUrl", "pricingUrl", "complianceUrl"]:
                validate_url(provider.get(field), f"'{name}/{pkey}'.{field}", notes_available)
            if "govDocsUrl" in provider:
                validate_url(provider.get("govDocsUrl"), f"'{name}/{pkey}'.govDocsUrl", notes_available)
            if "formerNames" in provider:
                former_names = provider.get("formerNames")
                if not isinstance(former_names, list) or not former_names:
                    err(f"'{name}/{pkey}'.formerNames must be a non-empty array when present")
                elif len(former_names) != len(set(former_names)) or any(not isinstance(item, str) or not item.strip() for item in former_names):
                    err(f"'{name}/{pkey}'.formerNames must contain unique non-empty strings")

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

    compliance_frameworks = mdata.get("complianceFrameworks", [])
    if not isinstance(compliance_frameworks, list) or not compliance_frameworks:
        err("complianceFrameworks must be a non-empty array")
        compliance_frameworks = []
    seen_compliance = set()
    for framework in compliance_frameworks:
        framework_id = framework.get("id", "MISSING") if isinstance(framework, dict) else "MISSING"
        require_fields(framework, COMPLIANCE_REQUIRED, f"compliance framework '{framework_id}'")
        if not isinstance(framework, dict):
            continue
        unexpected_compliance_fields = set(framework) - COMPLIANCE_ALLOWED
        if unexpected_compliance_fields:
            err(f"compliance framework '{framework_id}' contains unsupported fields: {sorted(unexpected_compliance_fields)}")
        if framework_id in seen_compliance:
            err(f"Duplicate compliance framework: '{framework_id}'")
        seen_compliance.add(framework_id)
        if framework.get("kind") not in COMPLIANCE_KIND:
            err(f"compliance framework '{framework_id}' invalid kind: {framework.get('kind')}")
        if framework.get("status") not in COMPLIANCE_STATUS:
            err(f"compliance framework '{framework_id}' invalid status: {framework.get('status')}")
        validate_url(framework.get("url"), f"compliance framework '{framework_id}'.url", False)
        validate_date(framework.get("lastVerified"), f"compliance framework '{framework_id}'.lastVerified")
        for field in ["name", "issuer", "scope"]:
            if not str(framework.get(field, "")).strip():
                err(f"compliance framework '{framework_id}'.{field} must not be empty")
        alignment = framework.get("nistAlignment")
        if isinstance(alignment, str):
            if not alignment.strip():
                err(f"compliance framework '{framework_id}'.nistAlignment must not be empty")
        elif isinstance(alignment, list):
            if not alignment or not all(isinstance(item, str) and item.strip() for item in alignment):
                err(f"compliance framework '{framework_id}'.nistAlignment must be a non-empty array of strings when using an array")
        else:
            err(f"compliance framework '{framework_id}'.nistAlignment must be a string or array of strings")
    info(f"complianceFrameworks: {len(compliance_frameworks)} entries")

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
    return providers, capabilities, tiers, frameworks, control_lens, compliance_frameworks


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


def validate_history(hdata):
    if not isinstance(hdata, dict):
        err("history.json must be an object")
        return []
    meta = hdata.get("_meta", {})
    require_fields(meta, ["version", "lastVerified", "scopeNote"], "history.json._meta")
    if isinstance(meta, dict):
        validate_date(meta.get("lastVerified"), "history.json._meta.lastVerified")
        if not str(meta.get("scopeNote", "")).strip():
            err("history.json._meta.scopeNote must not be empty")

    items = hdata.get("history", [])
    if not isinstance(items, list) or not items:
        err("history.json.history must be a non-empty array")
        return []

    seen_ids = set()
    seen_provider_phase = set()
    current_year = date.today().year
    for item in items:
        item_id = item.get("id", "MISSING") if isinstance(item, dict) else "MISSING"
        require_fields(item, HISTORY_REQUIRED, f"history '{item_id}'")
        if not isinstance(item, dict):
            continue
        unexpected_fields = set(item) - HISTORY_ALLOWED
        if unexpected_fields:
            err(f"history '{item_id}' contains unsupported fields: {sorted(unexpected_fields)}")
        if item_id in seen_ids:
            err(f"Duplicate history id: {item_id}")
        seen_ids.add(item_id)

        provider = item.get("provider")
        phase = item.get("phase")
        provider_phase = (provider, phase)
        if provider not in EXPECTED_PROVIDERS:
            err(f"history '{item_id}' invalid provider: {provider}")
        if phase not in VALID_HISTORY_PHASE:
            err(f"history '{item_id}' invalid phase: {phase}")
        if provider_phase in seen_provider_phase:
            warn(f"history provider/phase repeated: {provider}/{phase}")
        seen_provider_phase.add(provider_phase)

        year = item.get("year")
        if not isinstance(year, int) or year < 2000 or year > current_year:
            err(f"history '{item_id}'.year must be an integer from 2000 through {current_year}")
        validate_date(item.get("date"), f"history '{item_id}'.date")
        if not str(item.get("dateLabel", "")).strip():
            err(f"history '{item_id}'.dateLabel must not be empty")
        if not str(item.get("title", "")).strip():
            err(f"history '{item_id}'.title must not be empty")
        if not str(item.get("summary", "")).strip():
            err(f"history '{item_id}'.summary must not be empty")
        if not str(item.get("sourceLabel", "")).strip():
            err(f"history '{item_id}'.sourceLabel must not be empty")
        scope = item.get("scope", [])
        if not isinstance(scope, list) or not scope or not all(isinstance(entry, str) and entry.strip() for entry in scope):
            err(f"history '{item_id}'.scope must be a non-empty array of labels")
        validate_url(item.get("sourceUrl"), f"history '{item_id}'.sourceUrl", False)

    info(f"history.json: {len(items)} milestones")
    return items


def is_official_state_domain(url):
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    if host.endswith(".gov"):
        return True
    return any(host == domain or host.endswith(f".{domain}") for domain in RECOGNIZED_STATE_DOMAINS)


def validate_transparency(tdata):
    if not isinstance(tdata, dict):
        err("transparency.json must be an object")
        return [], {}

    meta = tdata.get("_meta", {})
    require_fields(meta, ["description", "last_verified"], "transparency.json._meta")
    if isinstance(meta, dict):
        validate_date(meta.get("last_verified"), "transparency.json._meta.last_verified")
        if not str(meta.get("description", "")).strip():
            err("transparency.json._meta.description must not be empty")
        federal_context = meta.get("federalContext", {})
        if isinstance(federal_context, dict):
            require_fields(federal_context, ["title", "citation", "url", "summary", "lastVerified"], "transparency.json._meta.federalContext")
            validate_url(federal_context.get("url"), "transparency.json._meta.federalContext.url", False)
            validate_date(federal_context.get("lastVerified"), "transparency.json._meta.federalContext.lastVerified")
        elif federal_context:
            err("transparency.json._meta.federalContext must be an object when present")

    mandates = tdata.get("mandates", [])
    if not isinstance(mandates, list) or not mandates:
        err("transparency.json.mandates must be a non-empty array")
        return [], meta

    seen_states = set()
    populated = 0
    for mandate in mandates:
        state = mandate.get("state", "MISSING") if isinstance(mandate, dict) else "MISSING"
        require_fields(mandate, TRANSPARENCY_REQUIRED, f"transparency mandate '{state}'")
        if not isinstance(mandate, dict):
            continue
        unexpected_fields = set(mandate) - TRANSPARENCY_ALLOWED
        if unexpected_fields:
            err(f"transparency mandate '{state}' contains unsupported fields: {sorted(unexpected_fields)}")

        if state not in EXPECTED_STATES:
            err(f"transparency mandate has invalid state code: {state}")
        elif mandate.get("stateName") != EXPECTED_STATES[state]:
            err(f"transparency mandate '{state}' stateName must be '{EXPECTED_STATES[state]}'")
        seen_states.add(state)

        if mandate.get("status") not in VALID_TRANSPARENCY_STATUS:
            err(f"transparency mandate '{state}' invalid status: {mandate.get('status')}")
        validate_date(mandate.get("lastVerified"), f"transparency mandate '{state}'.lastVerified")
        for field in ["instrument", "title", "summary"]:
            if not str(mandate.get(field, "")).strip():
                err(f"transparency mandate '{state}'.{field} must not be empty")

        url = mandate.get("url", "")
        status = mandate.get("status")
        if status == "Unknown":
            if url:
                err(f"transparency mandate '{state}' has status Unknown but non-empty url")
        else:
            populated += 1
            validate_url(url, f"transparency mandate '{state}'.url", False)
            if url and not is_official_state_domain(url):
                err(f"transparency mandate '{state}'.url must be on a .gov or recognized official state domain: {url}")
            if not str(mandate.get("citation", "")).strip():
                err(f"transparency mandate '{state}'.citation must not be empty when status is {status}")

    missing_states = set(EXPECTED_STATES) - seen_states
    extra_states = seen_states - set(EXPECTED_STATES)
    if missing_states:
        err(f"transparency.json missing state rows: {sorted(missing_states)}")
    if extra_states:
        err(f"transparency.json contains unsupported state rows: {sorted(extra_states)}")

    info(f"transparency.json: {len(mandates)} state/DC rows; {populated} populated")
    return mandates, meta


def normalized_host(url):
    parsed = urlparse(str(url))
    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def is_official_source_url(url):
    host = normalized_host(url)
    if host.endswith(".gov"):
        return True
    return any(host == domain or host.endswith(f".{domain}") for domain in OFFICIAL_SOURCE_DOMAINS)


def proposal_target_type(value):
    if not isinstance(value, dict):
        return "provider"
    return value.get("targetType", "provider")


def proposal_value_valid(field, value, label):
    if field == "service" and not str(value or "").strip():
        err(f"{label}.proposedValue for service must not be empty")
    elif field == "status" and value not in VALID_STATUS:
        err(f"{label}.proposedValue invalid for status: {value}")
    elif field == "govAvailability" and value not in VALID_GOV:
        err(f"{label}.proposedValue invalid for govAvailability: {value}")
    elif field == "parityLag" and value not in VALID_PARITY:
        err(f"{label}.proposedValue invalid for parityLag: {value}")
    elif field == "realmClass" and value not in VALID_REALM_CLASS:
        err(f"{label}.proposedValue invalid for realmClass: {value}")
    elif field == "lastVerified":
        validate_date(value, f"{label}.proposedValue for lastVerified")
    elif field == "region" and not str(value or "").strip():
        err(f"{label}.proposedValue for region must not be empty")
    elif field in PROPOSAL_FACT_URL_FIELDS:
        validate_url(value, f"{label}.proposedValue", True)
    elif field == "govVariant" and value is not None and not str(value).strip():
        err(f"{label}.proposedValue for govVariant must be non-empty or null")
    elif field == "formerNames":
        if not isinstance(value, list) or not value:
            err(f"{label}.proposedValue for formerNames must be a non-empty array")
        elif len(value) != len(set(value)) or any(not isinstance(item, str) or not item.strip() for item in value):
            err(f"{label}.proposedValue for formerNames must contain unique non-empty strings")


def validate_proposal_files(matrix):
    proposal_dir = DATA / "proposals"
    if not proposal_dir.exists():
        info("proposal files: none")
        return []

    cap_lookup = {
        cap.get("capability"): cap
        for cap in matrix.get("capabilities", [])
        if isinstance(cap, dict)
    }
    compliance_framework_lookup = {
        framework.get("id"): framework
        for framework in matrix.get("complianceFrameworks", [])
        if isinstance(framework, dict)
    }
    proposal_links = []
    files = sorted(proposal_dir.glob("*.json"))
    for path in files:
        pdata = load(path)
        label = f"proposal file '{path.relative_to(ROOT)}'"
        if not isinstance(pdata, dict):
            err(f"{label} must be an object")
            continue

        meta = pdata.get("_meta", {})
        require_fields(meta, ["schema", "generatedOn", "approved", "targetFields"], f"{label}._meta")
        if isinstance(meta, dict):
            if meta.get("schema") != "cloudintel-proposals-v1":
                err(f"{label}._meta.schema must be cloudintel-proposals-v1")
            validate_date(meta.get("generatedOn"), f"{label}._meta.generatedOn")
            if not isinstance(meta.get("approved"), bool):
                err(f"{label}._meta.approved must be boolean")
            target_fields = meta.get("targetFields", [])
            if (
                not isinstance(target_fields, list)
                or not target_fields
                or not all(isinstance(field, str) and field.strip() for field in target_fields)
            ):
                err(f"{label}._meta.targetFields must be a non-empty array of strings")
        approved = isinstance(meta, dict) and meta.get("approved") is True

        work_items = pdata.get("workItems", [])
        if not isinstance(work_items, list):
            err(f"{label}.workItems must be an array")
            work_items = []
        for index, item in enumerate(work_items):
            item_label = f"{label}.workItems[{index}]"
            target_type = proposal_target_type(item)
            required = PROPOSAL_WORK_ITEM_COMMON_REQUIRED
            if target_type == "provider":
                required = required + PROPOSAL_WORK_ITEM_PROVIDER_REQUIRED
            elif target_type == "complianceFramework":
                required = required + PROPOSAL_WORK_ITEM_COMPLIANCE_FRAMEWORK_REQUIRED
            else:
                err(f"{item_label}.targetType unsupported: {target_type}")
            require_fields(item, required, item_label)
            if not isinstance(item, dict):
                continue
            unexpected = set(item) - PROPOSAL_WORK_ITEM_ALLOWED
            if unexpected:
                err(f"{item_label} contains unsupported fields: {sorted(unexpected)}")
            if target_type == "provider":
                if item.get("provider") not in EXPECTED_PROVIDERS:
                    err(f"{item_label}.provider invalid: {item.get('provider')}")
                if item.get("field") not in PROPOSAL_PROVIDER_FIELDS:
                    err(f"{item_label}.field unsupported: {item.get('field')}")
                if item.get("capability") not in cap_lookup:
                    err(f"{item_label}.capability unknown: {item.get('capability')}")
            elif target_type == "complianceFramework":
                if item.get("frameworkId") not in compliance_framework_lookup:
                    err(f"{item_label}.frameworkId unknown: {item.get('frameworkId')}")
                if item.get("field") not in PROPOSAL_COMPLIANCE_FRAMEWORK_FIELDS:
                    err(f"{item_label}.field unsupported: {item.get('field')}")
            if not str(item.get("reason", "")).strip():
                err(f"{item_label}.reason must not be empty")

        proposals = pdata.get("proposals", [])
        if not isinstance(proposals, list):
            err(f"{label}.proposals must be an array")
            proposals = []
        for index, proposal in enumerate(proposals):
            proposal_label = f"{label}.proposals[{index}]"
            target_type = proposal_target_type(proposal)
            required = PROPOSAL_COMMON_REQUIRED
            if target_type == "provider":
                required = required + PROPOSAL_PROVIDER_REQUIRED
            elif target_type == "complianceFramework":
                required = required + PROPOSAL_COMPLIANCE_FRAMEWORK_REQUIRED
            else:
                err(f"{proposal_label}.targetType unsupported: {target_type}")
            require_fields(proposal, required, proposal_label)
            if not isinstance(proposal, dict):
                continue
            unexpected = set(proposal) - PROPOSAL_ALLOWED
            if unexpected:
                err(f"{proposal_label} contains unsupported fields: {sorted(unexpected)}")

            field = proposal.get("field")
            if target_type == "provider":
                cap = cap_lookup.get(proposal.get("capability"))
                if not cap:
                    err(f"{proposal_label}.capability unknown: {proposal.get('capability')}")
                    continue
                provider_key = proposal.get("provider")
                if provider_key not in EXPECTED_PROVIDERS:
                    err(f"{proposal_label}.provider invalid: {provider_key}")
                    continue
                provider = cap.get("providers", {}).get(provider_key)
                if not provider:
                    err(f"{proposal_label} references missing provider record: {provider_key}")
                    continue

                if field not in PROPOSAL_PROVIDER_FIELDS:
                    err(f"{proposal_label}.field unsupported: {field}")
                else:
                    expected_field = "proposedValue" if approved else "currentValue"
                    expected_value = proposal.get(expected_field)
                    if provider.get(field) != expected_value:
                        err(
                            f"{proposal_label}.{expected_field} mismatch for "
                            f"{proposal.get('capability')}/{provider_key}/{field}"
                        )
            elif target_type == "complianceFramework":
                framework = compliance_framework_lookup.get(proposal.get("frameworkId"))
                if not framework:
                    err(f"{proposal_label}.frameworkId unknown: {proposal.get('frameworkId')}")
                    continue
                if field not in PROPOSAL_COMPLIANCE_FRAMEWORK_FIELDS:
                    err(f"{proposal_label}.field unsupported: {field}")
                else:
                    expected_field = "proposedValue" if approved else "currentValue"
                    expected_value = proposal.get(expected_field)
                    if framework.get(field) != expected_value:
                        err(
                            f"{proposal_label}.{expected_field} mismatch for "
                            f"complianceFrameworks/{proposal.get('frameworkId')}/{field}"
                        )
            else:
                continue
            proposal_value_valid(field, proposal.get("proposedValue"), proposal_label)

            source_url = proposal.get("sourceUrl")
            validate_url(source_url, f"{proposal_label}.sourceUrl", False)
            if source_url:
                proposal_links.append((source_url, proposal_label))
                if not is_official_source_url(source_url):
                    err(f"{proposal_label}.sourceUrl is not an approved official primary source: {source_url}")
            if not str(proposal.get("sourceQuote", "")).strip():
                err(f"{proposal_label}.sourceQuote must not be empty")
            elif len(str(proposal.get("sourceQuote", "")).split()) >= 15:
                err(f"{proposal_label}.sourceQuote must be under 15 words")
            if not str(proposal.get("rationale", "")).strip():
                err(f"{proposal_label}.rationale must not be empty")
            validate_date(proposal.get("proposedOn"), f"{proposal_label}.proposedOn")

        info(f"{path.relative_to(ROOT)}: {len(work_items)} work item(s); {len(proposals)} proposal(s)")

    if not files:
        info("proposal files: none")
    return proposal_links


def is_timeout_error(exc):
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return True
    if isinstance(exc, urllib.error.URLError) and isinstance(exc.reason, (TimeoutError, socket.timeout)):
        return True
    return "timed out" in str(exc).lower()


def is_azure_pricing_url(url):
    parsed = urlparse(url)
    return parsed.netloc.lower() == "azure.microsoft.com" and "/pricing" in parsed.path.lower()


def open_link(url, method):
    request = urllib.request.Request(url, method=method, headers={"User-Agent": "CloudIntelMatrix-verify/3.0"})
    return urllib.request.urlopen(request, timeout=10)


def check_link(url, label, defer_timeout_warning=False):
    if not url:
        return None
    try:
        with open_link(url, "HEAD") as response:
            if response.status >= 400:
                warn(f"HTTP {response.status}: {label} - {url}")
    except urllib.error.HTTPError as exc:
        if exc.code in (403, 404, 405):
            try:
                with open_link(url, "GET") as response:
                    if response.status >= 400:
                        warn(f"HTTP {response.status}: {label} - {url}")
            except urllib.error.HTTPError as get_exc:
                if get_exc.code not in (403, 405):
                    warn(f"HTTP {get_exc.code}: {label} - {url}")
            except Exception as get_exc:
                if defer_timeout_warning and is_timeout_error(get_exc):
                    return "timeout"
                warn(f"Could not verify {label}: {get_exc}")
        else:
            warn(f"HTTP {exc.code}: {label} - {url}")
    except Exception as exc:
        if defer_timeout_warning and is_timeout_error(exc):
            return "timeout"
        warn(f"Could not verify {label}: {exc}")
    return None


def run_link_checks(capabilities, upcoming, history, frameworks, control_lens, compliance_frameworks, transparency, transparency_meta, proposal_links):
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
    for item in history:
        add_link(item.get("sourceUrl"), f"history/{item.get('id')}")
    for pkey, guidance in frameworks.items():
        for field in ["frameworkUrl", "foundationUrl"]:
            add_link(guidance.get(field), f"framework/{pkey}/{field}")
    for field in ["catalogUrl", "baselineUrl", "oscalUrl"]:
        add_link(control_lens.get(field), f"controlLens/{field}")
    for framework in compliance_frameworks:
        add_link(framework.get("url"), f"complianceFrameworks/{framework.get('id')}")
    for mandate in transparency:
        add_link(mandate.get("url"), f"transparency/{mandate.get('state')}")
    federal_context = transparency_meta.get("federalContext", {}) if isinstance(transparency_meta, dict) else {}
    add_link(federal_context.get("url"), "transparency/federalContext")
    for source_url, label in proposal_links:
        add_link(source_url, label)

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
        info(
            "Azure pricing link review skipped after repeated timeouts: "
            f"{len(azure_pricing_timeouts)} distinct URL(s) timed out and "
            f"{len(azure_pricing_skipped)} additional URL(s) were skipped "
            "to keep public link checks actionable."
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
    providers, capabilities, _, frameworks, control_lens, compliance_frameworks = validate_matrix(matrix)
    proposal_links = validate_proposal_files(matrix)

    upcoming = []
    history = []
    if not args.schema_only:
        upcoming_data = load(DATA / "upcoming.json")
        history_data = load(DATA / "history.json")
        transparency_data = load(DATA / "transparency.json")
        sources_data = load(DATA / "sources.json")
        if upcoming_data is None or history_data is None or transparency_data is None or sources_data is None:
            print("\n".join(ERRORS))
            return 1
        upcoming = validate_upcoming(upcoming_data)
        history = validate_history(history_data)
        transparency, transparency_meta = validate_transparency(transparency_data)
        if isinstance(sources_data, dict):
            info("sources.json: loaded")
    else:
        transparency = []
        transparency_meta = {}

    if args.check_links and not ERRORS:
        run_link_checks(capabilities, upcoming, history, frameworks, control_lens, compliance_frameworks, transparency, transparency_meta, proposal_links)

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
