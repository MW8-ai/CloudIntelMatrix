#!/usr/bin/env python3
"""cim — query the Cloud Intelligence Matrix from the command line.

Makes "Know" callable, not just browsable: the same verified capability and
compliance facts the site renders, answerable from a shell or a CI job.

Examples
--------
  python scripts/cim_query.py list --category "AI / ML"
  python scripts/cim_query.py show "Generative AI"
  python scripts/cim_query.py providers "Object Storage"
  # Where can a GenAI workload legally live at >= Partial gov availability?
  python scripts/cim_query.py gov --capability "Generative AI" --level Partial
  # CI gate: fail if no provider offers Managed Kubernetes in government at all
  python scripts/cim_query.py gov --capability "Kubernetes" --level Limited --provider azure

Add --json to any command for machine-readable output. Exit code is non-zero
when a query matches nothing, so `gov` doubles as a policy gate.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent.parent
DEFAULT_DATA = ROOT / "data" / "matrix.json"
PROVIDERS = ["aws", "azure", "gcp", "oci"]

# Government availability, strongest first. Used for threshold filtering:
# `--level Partial` matches Full and Partial. Unknown is weakest (unverified).
GOV_ORDER = ["Full", "Partial", "Limited", "None", "Unknown"]


def load(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["capabilities"]


def find(caps: list[dict], needle: str) -> list[dict]:
    """Case-insensitive substring match on capability name."""
    n = needle.lower()
    return [c for c in caps if n in c["capability"].lower()]


def gov_rank(value: str | None) -> int:
    """Lower rank = stronger availability. Unknown/missing sorts last."""
    try:
        return GOV_ORDER.index(value)
    except (ValueError, TypeError):
        return len(GOV_ORDER)


def meets(value: str | None, level: str) -> bool:
    """True if `value` is at least as strong as `level` (and not Unknown)."""
    if value is None or value == "Unknown":
        return False
    return gov_rank(value) <= gov_rank(level)


# ---------------------------------------------------------------- rendering
def emit(obj, as_json: bool, render) -> None:
    if as_json:
        print(json.dumps(obj, indent=2, ensure_ascii=False))
    else:
        render(obj)


def table(rows: list[list[str]], headers: list[str]) -> None:
    widths = [len(h) for h in headers]
    for r in rows:
        for i, cell in enumerate(r):
            widths[i] = max(widths[i], len(str(cell)))
    line = "  ".join(h.ljust(widths[i]) for i, h in enumerate(headers))
    print(line)
    print("  ".join("-" * widths[i] for i in range(len(headers))))
    for r in rows:
        print("  ".join(str(c).ljust(widths[i]) for i, c in enumerate(r)))


# ---------------------------------------------------------------- commands
def cmd_list(caps: list[dict], args) -> int:
    sel = caps
    if args.category:
        sel = [c for c in sel if c["category"].lower() == args.category.lower()]
    if args.tag:
        t = args.tag.upper()
        sel = [c for c in sel if t in [x.upper() for x in c.get("tags", [])]]
    if args.provider:
        sel = [c for c in sel if args.provider in c.get("providers", {})]
    if not sel:
        print("No capabilities match.", file=sys.stderr)
        return 1
    emit(
        [{"capability": c["capability"], "category": c["category"],
          "aiClassification": c.get("aiClassification")} for c in sel],
        args.json,
        lambda o: table([[r["capability"], r["category"], r["aiClassification"] or "—"] for r in o],
                        ["Capability", "Category", "AI"]),
    )
    return 0


def cmd_show(caps: list[dict], args) -> int:
    hits = find(caps, args.capability)
    if not hits:
        print(f"No capability matches '{args.capability}'.", file=sys.stderr)
        return 1
    if len(hits) > 1 and not args.json:
        print(f"'{args.capability}' matches {len(hits)}; narrow it:", file=sys.stderr)
        for c in hits:
            print(f"  - {c['capability']}", file=sys.stderr)
        return 1
    target = hits if args.json else [hits[0]]
    if args.json:
        emit(target, True, None)
        return 0
    c = target[0]
    print(f"{c['capability']}  ({c['category']})")
    print(f"AI: {c.get('aiClassification') or '—'}   tags: {', '.join(c.get('tags', [])) or '—'}")
    print(f"Last verified: {c.get('lastVerified', '—')}")
    if c.get("architectureNotes"):
        print(f"\n{c['architectureNotes']}")
    print()
    rows = []
    for p in PROVIDERS:
        pv = c.get("providers", {}).get(p)
        if not pv:
            rows.append([p, "—", "—", "—", "—"])
            continue
        rows.append([p, pv.get("service", "—"), pv.get("status", "—"),
                     pv.get("govAvailability", "—"), pv.get("parityLag", "—")])
    table(rows, ["Provider", "Service", "Status", "Gov", "ParityLag"])
    return 0


def cmd_providers(caps: list[dict], args) -> int:
    hits = find(caps, args.capability)
    if not hits:
        print(f"No capability matches '{args.capability}'.", file=sys.stderr)
        return 1
    c = hits[0]
    out = {p: c.get("providers", {}).get(p, {}) for p in PROVIDERS}
    emit(
        {"capability": c["capability"], "providers": out},
        args.json,
        lambda o: table(
            [[p, out[p].get("service", "—"), out[p].get("govAvailability", "—")] for p in PROVIDERS],
            ["Provider", "Service", "Gov"]),
    )
    return 0


def cmd_gov(caps: list[dict], args) -> int:
    if args.level not in GOV_ORDER:
        print(f"--level must be one of {GOV_ORDER}", file=sys.stderr)
        return 2
    provs = [args.provider] if args.provider else PROVIDERS
    pool = find(caps, args.capability) if args.capability else caps
    matches = []
    for c in pool:
        for p in provs:
            pv = c.get("providers", {}).get(p)
            if pv and meets(pv.get("govAvailability"), args.level):
                matches.append({
                    "capability": c["capability"], "provider": p,
                    "service": pv.get("service"), "gov": pv.get("govAvailability"),
                    "govVariant": pv.get("govVariant"),
                })
    if not matches:
        scope = f'"{args.capability}" ' if args.capability else ""
        print(f"No provider offers {scope}at >= {args.level} government availability.",
              file=sys.stderr)
        return 1
    emit(
        matches, args.json,
        lambda o: table([[m["capability"], m["provider"], m["service"] or "—",
                          m["gov"], m.get("govVariant") or "—"] for m in o],
                        ["Capability", "Provider", "Service", "Gov", "GovVariant"]),
    )
    return 0


def cmd_ai(caps: list[dict], args) -> int:
    want = "AI_NATIVE" if args.native else "AI_CAPABLE"
    sel = [c for c in caps if want in [t.upper() for t in c.get("tags", [])]
           or (want == "AI_CAPABLE" and "AI_NATIVE" in [t.upper() for t in c.get("tags", [])])]
    if not sel:
        print("No capabilities match.", file=sys.stderr)
        return 1
    emit(
        [{"capability": c["capability"], "aiClassification": c.get("aiClassification"),
          "category": c["category"]} for c in sel],
        args.json,
        lambda o: table([[r["capability"], r["aiClassification"] or "—", r["category"]] for r in o],
                        ["Capability", "AI", "Category"]),
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="cim", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", type=Path, default=DEFAULT_DATA, help="matrix.json path")
    p.add_argument("--json", action="store_true", help="machine-readable output")
    sub = p.add_subparsers(dest="cmd", required=True)

    lst = sub.add_parser("list", help="list capabilities")
    lst.add_argument("--category")
    lst.add_argument("--tag")
    lst.add_argument("--provider", choices=PROVIDERS)
    lst.set_defaults(func=cmd_list)

    sh = sub.add_parser("show", help="full detail for one capability")
    sh.add_argument("capability")
    sh.set_defaults(func=cmd_show)

    pr = sub.add_parser("providers", help="provider comparison for a capability")
    pr.add_argument("capability")
    pr.set_defaults(func=cmd_providers)

    gv = sub.add_parser("gov", help="filter by government availability (also a CI gate)")
    gv.add_argument("--level", required=True, help=f"one of {GOV_ORDER}")
    gv.add_argument("--capability", help="restrict to capabilities matching this substring")
    gv.add_argument("--provider", choices=PROVIDERS)
    gv.set_defaults(func=cmd_gov)

    ai = sub.add_parser("ai", help="AI-capable capabilities")
    ai.add_argument("--native", action="store_true", help="only AI_NATIVE")
    ai.set_defaults(func=cmd_ai)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        caps = load(args.data)
    except FileNotFoundError:
        print(f"matrix data not found: {args.data}", file=sys.stderr)
        return 2
    return args.func(caps, args)


if __name__ == "__main__":
    sys.exit(main())
