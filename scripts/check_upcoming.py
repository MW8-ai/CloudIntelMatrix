#!/usr/bin/env python3
"""
check_upcoming.py - Cloud provider release notes scanner
Runs weekly via update-check.yml GitHub Action.

Fetches available official RSS/Atom release-note feeds, scans entries from
the past N days for matrix-category keywords, and includes manual-review
sources where a provider does not expose a compatible feed.

Usage:
  python scripts/check_upcoming.py [--days 14] [--output issue_body.md]
"""

import json
import sys
import time
import argparse
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"

SOURCES = json.loads((DATA / "sources.json").read_text(encoding="utf-8"))
MATRIX  = json.loads((DATA / "matrix.json").read_text(encoding="utf-8"))

MATRIX_CATEGORIES = set(MATRIX.get("categories", []))

# Keywords per capability-v1 category - used to flag relevant release notes.
CATEGORY_KEYWORDS = {
    "Core Infrastructure":       ["ec2", "compute engine", "virtual machine", "lambda", "cloud run", "azure functions", "eks", "gke", "aks", "kubernetes", "container"],
    "Identity & Access":         ["iam", "entra", "identity", "sso", "mfa", "rbac", "zero trust", "workforce identity"],
    "Networking":                ["vpc", "cloudfront", "front door", "expressroute", "direct connect", "cloud interconnect", "waf", "cdn", "load balancer", "firewall"],
    "Storage":                   ["s3 ", "cloud storage", "blob storage", "object storage", "glacier", "archive storage"],
    "Databases":                 ["rds", "aurora", "dynamodb", "cloud sql", "spanner", "cosmos db", "alloydb", "postgresql", "mysql"],
    "Integration & Messaging":   ["apigee", "api gateway", "service bus", "eventbridge", "event grid", "pub/sub", "sqs", "sns", "kinesis", "mft", "sftp"],
    "Security & Compliance":     ["fedramp", "dod il", "cjis", "hipaa", "nist", "fips", "compliance", "security hub", "sentinel", "defender", "guardduty", "security command center"],
    "Monitoring & Operations":   ["cloudwatch", "cloud monitoring", "azure monitor", "prometheus", "grafana", "opentelemetry", "observability", "logging", "trace"],
    "Data & Analytics":          ["bigquery", "redshift", "athena", "synapse", "databricks", "lake formation", "dataflow", "glue", "fabric"],
    "AI / ML":                   ["sagemaker", "vertex ai", "azure machine learning", "bedrock", "generative ai", "genai", "foundation model", "llm", "training", "inference"],
    "Developer Platform":        ["codepipeline", "codebuild", "cloud build", "azure devops", "github actions", "ci/cd", "cicd", "binary authorization", "sbom", "devsecops"],
    "Government / Sovereign Cloud": ["govcloud", "assured workloads", "sovereign", "fedramp", "disa", "itar", "il4", "il5", "classified"],
    "Hybrid / Edge":             ["outposts", "azure arc", "distributed cloud", "edge", "migration", "migrate", "transfer", "replication", "database migration", "moderniz"],
    "Cost Governance":           ["cost", "billing", "savings plan", "reserved instance", "committed use", "rightsiz", "finops", "budget"],
}

unmapped_categories = sorted(set(CATEGORY_KEYWORDS) - MATRIX_CATEGORIES)
if unmapped_categories:
    raise RuntimeError(f"Scanner categories are not in matrix.json: {', '.join(unmapped_categories)}")

def fetch_feed(provider, url, max_retries=2):
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "CloudIntelMatrix-update-check/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2)
            else:
                print(f"[WARN] Could not fetch {provider} feed: {e}", file=sys.stderr)
    return None

def parse_feed(xml_text, provider, since_dt):
    """Parse RSS or Atom feed, return list of (title, link, date, summary) tuples."""
    entries = []
    if not xml_text:
        return entries
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"[WARN] XML parse error for {provider}: {e}", file=sys.stderr)
        return entries

    ns = {"atom": "http://www.w3.org/2005/Atom", "dc": "http://purl.org/dc/elements/1.1/"}

    # Atom feed
    atom_entries = root.findall("atom:entry", ns)
    if atom_entries:
        for entry in atom_entries:
            title   = (entry.findtext("atom:title", namespaces=ns) or "").strip()
            link_el = entry.find("atom:link", ns)
            link    = link_el.get("href", "") if link_el is not None else ""
            pub_str = entry.findtext("atom:published", namespaces=ns) or entry.findtext("atom:updated", namespaces=ns) or ""
            summary = (entry.findtext("atom:summary", namespaces=ns) or entry.findtext("atom:content", namespaces=ns) or "").strip()
            dt = parse_date(pub_str)
            if dt and dt >= since_dt:
                entries.append((title, link, dt, summary[:300]))
        return entries

    # RSS feed
    for item in root.iter("item"):
        title   = (item.findtext("title") or "").strip()
        link    = (item.findtext("link") or "").strip()
        pub_str = item.findtext("pubDate") or item.findtext("dc:date", namespaces=ns) or ""
        summary = (item.findtext("description") or "").strip()
        dt = parse_date(pub_str)
        if dt and dt >= since_dt:
            entries.append((title, link, dt, summary[:300]))
    return entries

def parse_date(value):
    if not value:
        return None
    value = value.strip()
    try:
        dt = parsedate_to_datetime(value)
        if dt:
            return dt.astimezone(timezone.utc)
    except (TypeError, ValueError):
        pass
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        pass
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        pass
    return None

def categorize_entry(title, summary):
    text = (title + " " + summary).lower()
    matched = []
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                matched.append(cat)
                break
    return sorted(set(matched))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=14, help="How many days back to scan")
    parser.add_argument("--max-items-per-provider", type=int, default=20, help="Maximum matching entries shown per provider")
    parser.add_argument("--output", type=str, default=None, help="Write issue body to this file")
    args = parser.parse_args()

    since_dt = datetime.now(timezone.utc) - timedelta(days=args.days)
    rss_feeds = SOURCES.get("rss_feeds", {})

    all_findings = {}  # provider -> list of findings
    all_matched_counts = {}
    feed_failures = []

    for provider, feed_url in rss_feeds.items():
        print(f"[INFO] Fetching {provider} feed...", file=sys.stderr)
        xml_text = fetch_feed(provider, feed_url)
        if xml_text is None:
            feed_failures.append(provider)
        entries  = parse_feed(xml_text, provider, since_dt)
        print(f"[INFO] {provider}: {len(entries)} entries since {since_dt.date()}", file=sys.stderr)

        findings = []
        for title, link, dt, summary in entries:
            cats = categorize_entry(title, summary)
            if cats:
                findings.append({
                    "title":   title,
                    "link":    link,
                    "date":    dt.strftime("%Y-%m-%d"),
                    "cats":    cats,
                    "summary": summary,
                })
        all_matched_counts[provider] = len(findings)
        all_findings[provider] = findings[:args.max_items_per_provider]

    # ── Build issue body ──────────────────────────────────────────────────
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = [
        f"## Cloud Matrix — Update Review ({today})",
        "",
        f"Automated scan of available official release-note feeds for the past **{args.days} days**.",
        "Review the items below and update `data/matrix.json` or `data/upcoming.json` as needed.",
        "",
        "> **This is an informational summary only.** All changes to data files must be",
        "> manually reviewed and verified against official documentation before committing.",
        "",
    ]

    total = sum(all_matched_counts.values())
    if feed_failures:
        failed = ", ".join(provider.upper() for provider in sorted(feed_failures))
        lines += [
            f"> Automatic feed retrieval failed for: **{failed}**. Review that provider's official update source manually.",
            "",
        ]

    if total == 0:
        lines.append("*No matching items were found in the automatic feed scan window.*")
    else:
        for provider, label in [("gcp", "GCP"), ("aws", "AWS"), ("azure", "Azure")]:
            findings = all_findings.get(provider, [])
            if provider not in rss_feeds:
                continue
            matched_count = all_matched_counts.get(provider, 0)
            lines.append(f"### {label} - {matched_count} potentially relevant item(s)")
            if not findings:
                lines.append("_No items matched matrix categories in this period._")
            else:
                for f in findings:
                    cat_tags = ", ".join(f"`{c}`" for c in f["cats"])
                    lines.append(f"- **[{f['date']}]** [{f['title']}]({f['link']})")
                    lines.append(f"  - Categories: {cat_tags}")
                    if f["summary"]:
                        # Truncate and clean summary
                        summary = f["summary"].replace("\n", " ").replace("<", "&lt;").replace(">", "&gt;")
                        if len(summary) > 200:
                            summary = summary[:200] + "…"
                        lines.append(f"  - _{summary}_")
                hidden_count = matched_count - len(findings)
                if hidden_count:
                    lines.append(f"- _{hidden_count} additional matched item(s) omitted; review the official feed for complete coverage._")
            lines.append("")

    manual_review_pages = SOURCES.get("manual_review_pages", {})
    if manual_review_pages:
        lines += ["### Manual Review Sources", ""]
        for provider, source in manual_review_pages.items():
            label = source.get("label", provider.upper())
            lines.append(f"- **{label}:** [{source['url']}]({source['url']})")
            if source.get("note"):
                lines.append(f"  - {source['note']}")
        lines.append("")

    lines += [
        "---",
        "### Action Checklist",
        "- [ ] Review each item above against current `data/matrix.json`",
        "- [ ] Update service names or notes in matrix.json if materially changed",
        "- [ ] Add new announced features to `data/upcoming.json` with `status: announced`",
        "- [ ] Promote `upcoming.json` items with `status: ga` to `matrix.json` and remove from upcoming",
        "- [ ] Update `_meta.last_verified` in `matrix.json` after review",
        "- [ ] Close this issue when review is complete",
        "",
        f"_Generated by `scripts/check_upcoming.py` · Scan window: {args.days} days · Run: {today}_",
    ]

    body = "\n".join(lines)
    print(body)

    if args.output:
        Path(args.output).write_text(body, encoding="utf-8")
        print(f"\n[INFO] Issue body written to {args.output}", file=sys.stderr)

if __name__ == "__main__":
    main()
