#!/usr/bin/env python3
"""
verify.py — Cloud Intelligence Matrix data validator (schema v3 / capability model)
"""
import json, sys, time, urllib.request, urllib.error
from pathlib import Path
from datetime import date

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"

ERRORS, WARNINGS, INFO = [], [], []
def err(m):  ERRORS.append(f"❌ {m}")
def warn(m): WARNINGS.append(f"⚠️  {m}")
def info(m): INFO.append(f"ℹ️  {m}")

def load(path):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        err(f"Missing: {path}"); return None
    except json.JSONDecodeError as e:
        err(f"Bad JSON in {path.name}: {e}"); return None

mdata = load(DATA / "matrix.json")
udata = load(DATA / "upcoming.json")
sdata = load(DATA / "sources.json")
if not all([mdata, udata, sdata]): print("\n".join(ERRORS)); sys.exit(1)

# ── 1. Meta ────────────────────────────────────────────────────────────────
meta = mdata.get("_meta", {})
for k in ["version","schema","last_verified","providers","tiers"]:
    if k not in meta: err(f"_meta missing: {k}")

PROVIDERS   = meta.get("providers", ["aws","azure","gcp"])
TIERS       = meta.get("tiers", [])
CAPS        = mdata.get("capabilities", [])
CATEGORIES  = mdata.get("categories", [])
TAG_DEFS    = mdata.get("tags", {})

# Required capability fields
CAP_REQUIRED = ["capability","category","tags","architectureNotes","operationalConsiderations","lastVerified","providers"]
PROV_REQUIRED = ["service","status","govAvailability","parityLag","docsUrl","pricingUrl","complianceUrl"]
VALID_GOV    = {"Full","Partial","Limited","None"}
VALID_PARITY = {"None","Minor","Moderate","Significant"}
VALID_STATUS = {"GA","Preview","Deprecated","Beta","Limited"}

seen_caps = set()
for cap in CAPS:
    name = cap.get("capability","MISSING")
    if name in seen_caps: err(f"Duplicate capability: '{name}'")
    seen_caps.add(name)
    for f in CAP_REQUIRED:
        if f not in cap: err(f"'{name}' missing field: {f}")
    if cap.get("category") not in CATEGORIES:
        warn(f"'{name}' category '{cap.get('category')}' not in categories list")
    for tag in cap.get("tags",[]):
        if tag not in TAG_DEFS: warn(f"'{name}' unknown tag: {tag}")
    for pkey in PROVIDERS:
        prov = cap.get("providers",{}).get(pkey)
        if not prov:
            err(f"'{name}' missing provider: {pkey}"); continue
        for f in PROV_REQUIRED:
            if f not in prov: err(f"'{name}/{pkey}' missing field: {f}")
        if prov.get("govAvailability") not in VALID_GOV:
            warn(f"'{name}/{pkey}' invalid govAvailability: {prov.get('govAvailability')}")
        if prov.get("parityLag") not in VALID_PARITY:
            warn(f"'{name}/{pkey}' invalid parityLag: {prov.get('parityLag')}")
        if prov.get("status") not in VALID_STATUS:
            warn(f"'{name}/{pkey}' invalid status: {prov.get('status')}")
        # tier notes completeness check
        tnotes = prov.get("tierNotes",{})
        for t in TIERS:
            if t not in tnotes: warn(f"'{name}/{pkey}' missing tierNotes for: {t}")

info(f"matrix.json: {len(CAPS)} capabilities · {len(PROVIDERS)} providers · schema {meta.get('schema')}")

# ── 2. Upcoming ────────────────────────────────────────────────────────────
VALID_USTATUS = {"preview","announced","ga","limited","deprecated"}
VALID_UTYPE   = {"expansion","new_region","new_feature","feature_ga","new_instance","deprecation_notice"}
seen_ids = set()
for item in udata.get("upcoming",[]):
    iid = item.get("id","MISSING")
    if iid in seen_ids: err(f"Duplicate upcoming id: {iid}")
    seen_ids.add(iid)
    for f in ["id","provider","category","title","detail","status","source"]:
        if f not in item: err(f"upcoming '{iid}' missing: {f}")
    if item.get("status") not in VALID_USTATUS:
        warn(f"upcoming '{iid}' unknown status: {item.get('status')}")
    if item.get("status") == "ga":
        warn(f"upcoming '{iid}' status=ga — promote to matrix.json and remove")
    ega = item.get("expected_ga")
    if ega and len(str(ega)) == 4:
        if int(ega) < date.today().year:
            warn(f"upcoming '{iid}' expected_ga={ega} is past — verify or remove")

info(f"upcoming.json: {len(udata.get('upcoming',[]))} items")

# ── 3. URL checks ──────────────────────────────────────────────────────────
def check(url, label):
    if not url: return
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent":"cloud-matrix-verify/2.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            if r.status >= 400: err(f"HTTP {r.status}: {label}")
    except urllib.error.HTTPError as e:
        if e.code not in (403, 405): err(f"HTTP {e.code}: {label} — {url}")
    except Exception as e:
        warn(f"Could not verify {label}: {e}")

print("Checking source URLs...")
for cap in CAPS:
    for pkey in PROVIDERS:
        prov = cap.get("providers",{}).get(pkey,{})
        name = cap.get("capability","?")
        for field in ["docsUrl","pricingUrl","complianceUrl","govDocsUrl"]:
            url = prov.get(field)
            if url: check(url, f"{name}/{pkey}/{field}"); time.sleep(0.2)

for item in udata.get("upcoming",[]):
    if item.get("source"): check(item["source"], f"upcoming/{item.get('id')}"); time.sleep(0.2)

# ── Summary ────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("CLOUD INTELLIGENCE MATRIX — VERIFICATION REPORT")
print("="*60)
for m in INFO: print(f"  {m}")
if WARNINGS:
    print(f"\n⚠️  Warnings ({len(WARNINGS)}):")
    for m in WARNINGS: print(f"  {m}")
if ERRORS:
    print(f"\n❌ Errors ({len(ERRORS)}):")
    for m in ERRORS: print(f"  {m}")
    print(f"\nResult: FAILED — {len(ERRORS)} error(s)")
    sys.exit(1)
else:
    print(f"\n✅ PASSED — 0 errors · {len(WARNINGS)} warnings")
    sys.exit(0)
