#!/usr/bin/env python3
"""
check_upcoming.py — Cloud provider release notes scanner
Runs weekly via update-check.yml GitHub Action.

Fetches official RSS/Atom release note feeds from GCP, AWS, and Azure.
Scans entries from the past N days for keywords matching matrix categories.
Prints a formatted markdown summary suitable for a GitHub Issue body.

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
from pathlib import Path

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data"

SOURCES = json.loads((DATA / "sources.json").read_text())
MATRIX  = json.loads((DATA / "matrix.json").read_text())

ALL_CATEGORIES = [c for cats in MATRIX["category_groups"].values() for c in cats]

# Keywords per category — used to flag relevant release notes
CATEGORY_KEYWORDS = {
    "Compute":                   ["ec2","compute engine","virtual machine","vm","instance","graviton","c3","m3","n2","outpost"],
    "Serverless":                ["lambda","cloud functions","cloud run","azure functions","serverless","faas"],
    "Containers / K8s":          ["eks","gke","aks","kubernetes","container","k8s","anthos","fargate","karpenter"],
    "Object Storage":            ["s3 ","cloud storage","blob storage","object storage","glacier","nearline"],
    "Databases":                 ["rds","aurora","dynamodb","cloud sql","spanner","cosmos db","alloydb","postgresql","mysql","redis"],
    "AI / ML Platform":          ["sagemaker","vertex ai","azure machine learning","mlops","feature store","training","inference"],
    "Generative AI":             ["bedrock","generative ai","genai","llm","foundation model","claude","gpt","gemini","copilot","prompt"],
    "Data & Analytics":          ["bigquery","redshift","athena","synapse","databricks","lake formation","dataflow","glue","fabric"],
    "Networking":                ["vpc","cloudfront","expressroute","direct connect","cloud interconnect","waf","cdn","load balancer","firewall"],
    "Identity & Access":         ["iam","entra","identity","sso","mfa","rbac","zero trust","pivcac","workforce identity"],
    "Security & Compliance":     ["fedramp","dod il","cjis","hipaa","nist","fips","soc 2","compliance","security hub","sentinel","defender","guarduty","scc"],
    "Integration / MFT":         ["apigee","api gateway","service bus","transfer family","eventbridge","mft","sftp","as2","step functions"],
    "Regions — Geographic":      ["new region","availability zone","local zone","wavelength","edge location","point of presence"],
    "Regions — Sovereign":       ["govcloud","assured workloads","sovereign","fedramp","disa","itar","cjis","il4","il5","classified"],
    "Regions — Latency & Edge":  ["edge zone","wavelength","local zone","cloudfront pop","cdn","distributed cloud"],
    "SDKs & Languages":          ["sdk","client library","boto3","terraform provider","bicep","cdk","pulumi"],
    "IaC & Query Languages":     ["cloudformation","terraform","bicep","arm template","config connector","deployment manager","cdk"],
    "Monitoring / Observability":["cloudwatch","cloud monitoring","azure monitor","prometheus","grafana","opentelemetry","siem","chronicle","sentinel"],
    "Migration Tools":           ["migration","migrate","transfer","replication","dms","database migration","lift and shift","moderniz"],
    "Cost Management":           ["cost","billing","savings plan","reserved instance","committed use","rightsiz","finops","budget"],
    "IoT / Edge":                ["iot","edge","greengrass","azure sphere","distributed cloud edge","tpu","industrial","rtos"],
    "DevOps / CI-CD":            ["codepipeline","cloud build","azure devops","github actions","ci/cd","cicd","binary authorization","sbom","supply chain","devsecops"],
    "Support":                   ["support plan","premium support","technical account manager","tam","enterprise support"],
}

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

    ns = {"atom": "http://www.w3.org/2005/Atom"}

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
        pub_str = item.findtext("pubDate") or item.findtext("dc:date") or ""
        summary = (item.findtext("description") or "").strip()
        dt = parse_date(pub_str)
        if dt and dt >= since_dt:
            entries.append((title, link, dt, summary[:300]))
    return entries

def parse_date(s):
    if not s:
        return None
    s = s.strip()
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(s[:len(fmt)+5], fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            continue
    return None

def categorize_entry(title, summary):
    text = (title + " " + summary).lower()
    matched = []
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                matched.append(cat)
                break
    return list(set(matched))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=14, help="How many days back to scan")
    parser.add_argument("--output", type=str, default=None, help="Write issue body to this file")
    args = parser.parse_args()

    since_dt = datetime.now(timezone.utc) - timedelta(days=args.days)
    rss_feeds = SOURCES.get("rss_feeds", {})

    all_findings = {}  # provider -> list of findings

    for provider, feed_url in rss_feeds.items():
        print(f"[INFO] Fetching {provider} feed...", file=sys.stderr)
        xml_text = fetch_feed(provider, feed_url)
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
        all_findings[provider] = findings

    # ── Build issue body ──────────────────────────────────────────────────
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = [
        f"## Cloud Matrix — Update Review ({today})",
        "",
        f"Automated scan of official release note feeds for the past **{args.days} days**.",
        "Review the items below and update `data/matrix.json` or `data/upcoming.json` as needed.",
        "",
        "> **This is an informational summary only.** All changes to data files must be",
        "> manually reviewed and verified against official documentation before committing.",
        "",
    ]

    total = sum(len(v) for v in all_findings.values())
    if total == 0:
        lines.append("*No relevant release notes found in the scan window. No action needed.*")
    else:
        for provider in ["GCP", "AWS", "Azure"]:
            findings = all_findings.get(provider, [])
            lines.append(f"### {provider} — {len(findings)} potentially relevant item(s)")
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
        Path(args.output).write_text(body)
        print(f"\n[INFO] Issue body written to {args.output}", file=sys.stderr)

if __name__ == "__main__":
    main()
