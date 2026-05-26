#!/usr/bin/env python3
"""
generate_xlsx.py — Generates Cloud_Intelligence_Matrix.xlsx from data/matrix.json
Reads new capability-v1 schema.
Output: dist/Cloud_Intelligence_Matrix.xlsx
"""
import json, sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print("pip install openpyxl"); sys.exit(1)

ROOT   = Path(__file__).parent.parent
DATA   = ROOT / "data"
OUTDIR = ROOT / "dist"
OUTDIR.mkdir(exist_ok=True)

mdata = json.loads((DATA / "matrix.json").read_text())
udata = json.loads((DATA / "upcoming.json").read_text())

META       = mdata["_meta"]
CAPS       = mdata["capabilities"]
CATEGORIES = mdata["categories"]
TAG_DEFS   = mdata["tags"]
FRAMEWORKS = mdata["frameworks"]
CONTROL_LENS = mdata["controlLens"]
PATTERNS   = mdata["patterns"]
TIERS      = META["tiers"]
PROVIDERS  = META["providers"]
UPCOMING   = udata.get("upcoming", [])
CAP_MAP    = {cap["capability"]: cap for cap in CAPS}

PROV_LABELS = {"aws":"AWS","azure":"Azure","gcp":"GCP","oci":"OCI"}
PROV_COLORS = {
    "aws":   {"hdr":"B45309","note":"FEF3C7","svc":"FFFBEB"},
    "azure": {"hdr":"0E7490","note":"CFFAFE","svc":"ECFEFF"},
    "gcp":   {"hdr":"1A56A0","note":"DBEAFE","svc":"EFF6FF"},
    "oci":   {"hdr":"9F3727","note":"FCE7E4","svc":"FFF4F2"},
}
MATRIX_COLS = 4 + len(PROVIDERS) * 2
TAG_FG = {
    "gray":"6B7280","blue":"2563EB","purple":"7C3AED","green":"15803D",
    "amber":"B45309","red":"B91C1C","cyan":"0891B2","slate":"475569",
    "teal":"0D9488","orange":"C2410C","yellow":"A16207","rose":"BE123C",
}
GOV_COLORS = {
    "Full":"065F46","Partial":"78350F","Limited":"7C2D12","None":"374151",
}
PARITY_COLORS = {
    "None":"374151","Minor":"92400E","Moderate":"B45309","Significant":"991B1B",
}

THIN = Side(style="thin", color="D0D7E3")
TB   = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
def f(h):     return PatternFill("solid", fgColor=h.lstrip("#"))
def ft(bold=False, size=9, color="111827", italic=False):
    return Font(name="Arial", bold=bold, size=size, color=color.lstrip("#"), italic=italic)
def al(h="left", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def hdr(ws, text, ncols):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ncols)
    c = ws["A1"]
    c.value = text
    c.font = Font(name="Arial", bold=True, size=12, color="FFFFFF")
    c.fill = f("0F1A2E")
    c.alignment = al("center","center")
    ws.row_dimensions[1].height = 26

def build_matrix_sheet(ws, tier=None):
    """One sheet: capability rows, provider cols (service + gov + parity), optionally filtered to tier."""
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "B3"
    title = f"Cloud Intelligence Matrix — {tier or 'All Tiers'}"
    hdr(ws, title, MATRIX_COLS)

    # Row 2: column headers
    col_headers = [
        ("Category",    "1E3A5F"),
        ("Capability",  "1E3A5F"),
        ("Tags",        "1E3A5F"),
    ]
    for pkey in PROVIDERS:
        col_headers.extend([
            (f"{PROV_LABELS[pkey]} Service", PROV_COLORS[pkey]["hdr"]),
            (f"{PROV_LABELS[pkey]} Gov", PROV_COLORS[pkey]["hdr"]),
        ])
    col_headers.append(("Verified", "1E3A5F"))
    for ci, (h, bg) in enumerate(col_headers, 1):
        c = ws.cell(row=2, column=ci, value=h)
        c.fill = f(bg); c.font = Font(name="Arial", bold=True, size=8, color="FFFFFF")
        c.alignment = al("center","center"); c.border = TB
    ws.row_dimensions[2].height = 16

    row = 3
    last_cat = None
    for cap in CAPS:
        cat = cap["category"]
        bg_cat = "F0F9FF" if CATEGORIES.index(cat) % 2 == 0 else "F8FAFC"

        # Category cell
        cc = ws.cell(row=row, column=1, value=cap["category"] if cat != last_cat else "")
        cc.fill = f("E0F2FE" if cat != last_cat else bg_cat)
        cc.font = Font(name="Arial", bold=True, size=8, color="0369A1")
        cc.alignment = al("center","center", wrap=True); cc.border = TB
        last_cat = cat

        # Capability
        capcel = ws.cell(row=row, column=2, value=cap["capability"])
        capcel.fill = f(bg_cat); capcel.font = ft(bold=True, size=9, color="111827")
        capcel.alignment = al("left","center", wrap=True); capcel.border = TB

        # Tags
        tc = ws.cell(row=row, column=3, value=" · ".join(cap.get("tags",[])))
        tc.fill = f(bg_cat); tc.font = ft(size=8, italic=True, color="374151")
        tc.alignment = al("left","center", wrap=True); tc.border = TB

        # Provider columns (svc + gov)
        for pi, pkey in enumerate(PROVIDERS):
            prov = cap.get("providers",{}).get(pkey,{})
            svc  = prov.get("service","—")
            if tier:
                svc = prov.get("tierNotes",{}).get(tier, svc)
            gov  = prov.get("govAvailability","—")
            par  = prov.get("parityLag","None")
            pc   = PROV_COLORS[pkey]

            # Service
            sc = ws.cell(row=row, column=4+pi*2, value=svc)
            sc.fill = f(pc["svc"]); sc.font = ft(size=9)
            sc.alignment = al("left","center",wrap=True); sc.border = TB

            # Gov + parity
            gov_txt = gov
            if par and par != "None": gov_txt += f" · LAG:{par}"
            gc = ws.cell(row=row, column=5+pi*2, value=gov_txt)
            gov_bg = {"Full":"D1FAE5","Partial":"FEF3C7","Limited":"FFE4E6","None":"F9FAFB"}.get(gov,"F9FAFB")
            gc.fill = f(gov_bg); gc.font = ft(size=8, bold=(gov!="Full"), color=GOV_COLORS.get(gov,"374151"))
            gc.alignment = al("center","center"); gc.border = TB

        # Verified
        vc = ws.cell(row=row, column=MATRIX_COLS, value=cap.get("lastVerified",""))
        vc.fill = f(bg_cat); vc.font = ft(size=8, color="6B7280")
        vc.alignment = al("center","center"); vc.border = TB

        ws.row_dimensions[row].height = 34
        row += 1

    # Widths
    for col, w in {"A":22,"B":30,"C":36}.items():
        ws.column_dimensions[col].width = w
    for pi, _ in enumerate(PROVIDERS):
        ws.column_dimensions[get_column_letter(4 + pi * 2)].width = 38
        ws.column_dimensions[get_column_letter(5 + pi * 2)].width = 18
    ws.column_dimensions[get_column_letter(MATRIX_COLS)].width = 12

def build_detail_sheet(ws):
    """Full detail: one row per capability×provider with arch notes and operational considerations."""
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "A3"
    hdr(ws, "Capability Detail — Architecture Notes · Operational Considerations · All Tier Notes", 12)

    hdrs = ["Category","Capability","Provider","Service","Gov Avail","Parity Lag","Gov Variant",
            "Docs","Pricing","Compliance","Architecture Notes","Operational Considerations"]
    for ci, h in enumerate(hdrs, 1):
        c = ws.cell(row=2, column=ci, value=h)
        c.fill = f("1E3A5F"); c.font = Font(name="Arial", bold=True, size=8, color="FFFFFF")
        c.alignment = al("center","center"); c.border = TB
    ws.row_dimensions[2].height = 16

    row = 3
    for cap in CAPS:
        for pi, pkey in enumerate(PROVIDERS):
            prov = cap.get("providers",{}).get(pkey,{})
            bg = PROV_COLORS[pkey]["svc"]
            vals = [
                cap["category"], cap["capability"], PROV_LABELS[pkey],
                prov.get("service",""), prov.get("govAvailability",""), prov.get("parityLag",""),
                prov.get("govVariant",""),
                prov.get("docsUrl",""), prov.get("pricingUrl",""), prov.get("complianceUrl",""),
                cap.get("architectureNotes",""), cap.get("operationalConsiderations",""),
            ]
            for ci, v in enumerate(vals, 1):
                c = ws.cell(row=row, column=ci, value=v)
                c.fill = f(bg); c.font = ft(size=8)
                c.alignment = al("left","center", wrap=True); c.border = TB
            ws.row_dimensions[row].height = 40
            row += 1

    for col, w in {"A":16,"B":22,"C":8,"D":30,"E":12,"F":14,"G":26,"H":44,"I":44,"J":44,"K":60,"L":60}.items():
        ws.column_dimensions[col].width = w

def build_gov_sheet(ws):
    """Government and parity focus sheet."""
    ws.sheet_view.showGridLines = False
    hdr(ws, "Government / Sovereign Cloud Availability & Parity Lag — Cloud Intelligence Matrix", MATRIX_COLS)
    hdrs = ["Category","Capability","Tags"]
    for pkey in PROVIDERS:
        hdrs.extend([f"{PROV_LABELS[pkey]} Gov", f"{PROV_LABELS[pkey]} Parity"])
    hdrs.append("Verified")
    for ci, h in enumerate(hdrs, 1):
        c = ws.cell(row=2, column=ci, value=h)
        c.fill = f("7F1D1D"); c.font = Font(name="Arial", bold=True, size=8, color="FFFFFF")
        c.alignment = al("center","center"); c.border = TB
    ws.row_dimensions[2].height = 16

    row = 3
    for cap in CAPS:
        has_issue = any(
            cap["providers"].get(p,{}).get("govAvailability") != "Full" or
            (cap["providers"].get(p,{}).get("parityLag","None") != "None")
            for p in PROVIDERS
        )
        bg = "FFF1F2" if has_issue else "F9FAFB"
        vals_head = [cap["category"], cap["capability"], " · ".join(cap.get("tags",[]))]
        for ci, v in enumerate(vals_head, 1):
            c = ws.cell(row=row, column=ci, value=v)
            c.fill = f(bg); c.font = ft(bold=(ci==2), size=9)
            c.alignment = al("left","center", wrap=True); c.border = TB

        for pi, pkey in enumerate(PROVIDERS):
            prov = cap.get("providers",{}).get(pkey,{})
            gov = prov.get("govAvailability","—")
            par = prov.get("parityLag","—")
            gov_bg = {"Full":"D1FAE5","Partial":"FEF3C7","Limited":"FFE4E6","None":"F9FAFB"}.get(gov,"F9FAFB")
            par_bg = {"None":"F9FAFB","Minor":"FEF3C7","Moderate":"FFE4E6","Significant":"FEE2E2"}.get(par,"F9FAFB")
            gc = ws.cell(row=row, column=4+pi*2, value=gov)
            gc.fill = f(gov_bg); gc.font = ft(bold=(gov!="Full"), size=8)
            gc.alignment = al("center","center"); gc.border = TB
            pc = ws.cell(row=row, column=5+pi*2, value=par)
            pc.fill = f(par_bg); pc.font = ft(bold=(par!="None"), size=8)
            pc.alignment = al("center","center"); pc.border = TB

        vc = ws.cell(row=row, column=MATRIX_COLS, value=cap.get("lastVerified",""))
        vc.fill = f(bg); vc.font = ft(size=8, color="6B7280")
        vc.alignment = al("center","center"); vc.border = TB
        ws.row_dimensions[row].height = 28
        row += 1

    for col, w in {"A":16,"B":26,"C":40}.items():
        ws.column_dimensions[col].width = w
    for pi, _ in enumerate(PROVIDERS):
        ws.column_dimensions[get_column_letter(4 + pi * 2)].width = 14
        ws.column_dimensions[get_column_letter(5 + pi * 2)].width = 16
    ws.column_dimensions[get_column_letter(MATRIX_COLS)].width = 12

def build_patterns_sheet(ws):
    """Architecture planning overlays grounded in the existing capability rows."""
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "C3"
    pattern_cols = 6 + len(PROVIDERS)
    hdr(ws, "Architecture Patterns - Provider Framework-Informed Planning Overlays", pattern_cols)
    headers = [
        "Pattern / Rationale", "When To Use", "Capability",
    ]
    headers.extend(f"{PROV_LABELS[pkey]} Service / Gov" for pkey in PROVIDERS)
    headers.extend(["Review Questions", "Verification Boundary", "Verified"])
    for ci, header in enumerate(headers, 1):
        c = ws.cell(row=2, column=ci, value=header)
        c.fill = f("1E3A5F")
        c.font = Font(name="Arial", bold=True, size=8, color="FFFFFF")
        c.alignment = al("center", "center")
        c.border = TB
    ws.row_dimensions[2].height = 18

    row = 3
    for pattern in PATTERNS:
        for index, capability_name in enumerate(pattern["capabilities"]):
            cap = CAP_MAP[capability_name]
            is_first = index == 0
            values = [
                f"{pattern['name']}\n{pattern['summary']}" if is_first else "",
                pattern["whenToUse"] if is_first else "",
                capability_name,
            ]
            values.extend(
                f"{cap['providers'][pkey]['service']}\nGov: {cap['providers'][pkey]['govAvailability']} / Lag: {cap['providers'][pkey]['parityLag']}"
                for pkey in PROVIDERS
            )
            values.extend([
                "\n".join(pattern["reviewPrompts"]) if is_first else "",
                pattern["verificationNote"] if is_first else "",
                pattern["lastVerified"] if is_first else "",
            ])
            for ci, value in enumerate(values, 1):
                c = ws.cell(row=row, column=ci, value=value)
                c.fill = f("F8FAFC" if is_first else "FFFFFF")
                c.font = ft(bold=(ci == 3), size=8)
                c.alignment = al("left", "top", wrap=True)
                c.border = TB
            ws.row_dimensions[row].height = 68 if is_first else 34
            row += 1
        row += 1

    row += 1
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=pattern_cols)
    c = ws.cell(row=row, column=1, value="Official framework and enterprise foundation guidance")
    c.fill = f("0F1A2E")
    c.font = Font(name="Arial", bold=True, size=10, color="FFFFFF")
    c.alignment = al("left", "center")
    row += 1
    source_headers = ["Provider", "Architecture Framework", "Framework URL", "Enterprise Foundation Guidance", "Foundation URL", "Verified"]
    for ci, header in enumerate(source_headers, 1):
        c = ws.cell(row=row, column=ci, value=header)
        c.fill = f("1E3A5F")
        c.font = Font(name="Arial", bold=True, size=8, color="FFFFFF")
        c.alignment = al("center", "center")
        c.border = TB
    row += 1
    for pkey in PROVIDERS:
        guidance = FRAMEWORKS[pkey]
        values = [
            PROV_LABELS[pkey], guidance["framework"], guidance["frameworkUrl"],
            guidance["foundation"], guidance["foundationUrl"], guidance["lastVerified"],
        ]
        for ci, value in enumerate(values, 1):
            c = ws.cell(row=row, column=ci, value=value)
            c.fill = f(PROV_COLORS[pkey]["svc"])
            c.font = ft(size=8, color="2563EB" if ci in [3, 5] else "111827")
            c.alignment = al("left", "center", wrap=True)
            c.border = TB
            if ci in [3, 5]:
                c.hyperlink = value
        row += 1

    for col, width in {"A":38, "B":38, "C":32}.items():
        ws.column_dimensions[col].width = width
    for index, _ in enumerate(PROVIDERS, 4):
        ws.column_dimensions[get_column_letter(index)].width = 35
    ws.column_dimensions[get_column_letter(4 + len(PROVIDERS))].width = 38
    ws.column_dimensions[get_column_letter(5 + len(PROVIDERS))].width = 40
    ws.column_dimensions[get_column_letter(6 + len(PROVIDERS))].width = 14

def build_controls_sheet(ws):
    """Selected NIST SP 800-53 Rev. 5 control families mapped to architecture decisions."""
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = "A3"
    hdr(ws, f"{CONTROL_LENS['name']} - {CONTROL_LENS['release']} Architecture Planning Lens", 6)
    headers = ["Family", "Implementation Focus", "Linked Capabilities", "Architecture Review Questions", "Boundary", "Verified"]
    for ci, header in enumerate(headers, 1):
        c = ws.cell(row=2, column=ci, value=header)
        c.fill = f("1E3A5F")
        c.font = Font(name="Arial", bold=True, size=8, color="FFFFFF")
        c.alignment = al("center", "center")
        c.border = TB
    ws.row_dimensions[2].height = 18

    for row, family in enumerate(CONTROL_LENS["families"], 3):
        values = [
            f"{family['id']} - {family['name']}",
            family["applicability"],
            "\n".join(family["capabilities"]),
            "\n".join(family["reviewPrompts"]),
            CONTROL_LENS["scopeNote"] if row == 3 else "",
            CONTROL_LENS["lastVerified"],
        ]
        bg = "EFF6FF" if row % 2 else "F8FAFC"
        for ci, value in enumerate(values, 1):
            c = ws.cell(row=row, column=ci, value=value)
            c.fill = f(bg)
            c.font = ft(bold=(ci == 1), size=8)
            c.alignment = al("left", "top", wrap=True)
            c.border = TB
        ws.row_dimensions[row].height = 62

    row = len(CONTROL_LENS["families"]) + 5
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
    c = ws.cell(row=row, column=1, value="Official NIST reference basis")
    c.fill = f("0F1A2E")
    c.font = Font(name="Arial", bold=True, size=10, color="FFFFFF")
    c.alignment = al("left", "center")
    source_rows = [
        ("Catalog", CONTROL_LENS["catalogUrl"]),
        ("Control baselines", CONTROL_LENS["baselineUrl"]),
        ("OSCAL content", CONTROL_LENS["oscalUrl"]),
    ]
    for offset, (label, url) in enumerate(source_rows, 1):
        ws.cell(row=row + offset, column=1, value=label)
        source_cell = ws.cell(row=row + offset, column=2, value=url)
        source_cell.hyperlink = url
        for ci in range(1, 7):
            cell = ws.cell(row=row + offset, column=ci)
            cell.fill = f("F8FAFC")
            cell.font = ft(bold=(ci == 1), size=8, color="2563EB" if ci == 2 else "111827")
            cell.alignment = al("left", "center", wrap=True)
            cell.border = TB

    for col, width in {"A":30, "B":55, "C":42, "D":58, "E":58, "F":14}.items():
        ws.column_dimensions[col].width = width

def build_upcoming_sheet(ws):
    ws.sheet_view.showGridLines = False
    hdr(ws, "Announced / Preview / Upcoming — Official Sources Only", 10)
    hdrs = ["ID","Provider","Category","Type","Status","Title","Expected GA","Source","Detail","Verified"]
    for ci, h in enumerate(hdrs, 1):
        c = ws.cell(row=2, column=ci, value=h)
        c.fill = f("78350F"); c.font = Font(name="Arial", bold=True, size=8, color="FFFFFF")
        c.alignment = al("center","center"); c.border = TB
    ws.row_dimensions[2].height = 16

    STATUS_BG = {"ga":"D1FAE5","preview":"EDE9FE","announced":"FEF3C7","limited":"FFE4E6"}
    for ri, item in enumerate(UPCOMING, 3):
        bg = STATUS_BG.get(item.get("status",""),"F9FAFB")
        vals = [item.get("id",""),item.get("provider",""),item.get("category",""),
                item.get("type",""),item.get("status",""),item.get("title",""),
                item.get("expected_ga",""),item.get("source",""),item.get("detail",""),
                str(item.get("verified",""))]
        for ci, v in enumerate(vals, 1):
            c = ws.cell(row=ri, column=ci, value=v)
            c.fill = f(bg); c.font = ft(size=8)
            c.alignment = al("left","center", wrap=True); c.border = TB
        ws.row_dimensions[ri].height = 34

    for col, w in {"A":22,"B":8,"C":22,"D":18,"E":12,"F":38,"G":12,"H":50,"I":60,"J":10}.items():
        ws.column_dimensions[col].width = w

# ── Build ──────────────────────────────────────────────────────────────────
wb = Workbook()
wb.remove(wb.active)

ws1 = wb.create_sheet("Matrix — All Tiers")
build_matrix_sheet(ws1)

for tier in TIERS:
    short = {"Personal / Free":"Free","Commercial / SMB":"SMB","Enterprise":"Enterprise","Government":"Govt"}[tier]
    ws = wb.create_sheet(f"Matrix — {short}")
    build_matrix_sheet(ws, tier=tier)

ws_detail = wb.create_sheet("Full Detail")
build_detail_sheet(ws_detail)

ws_gov = wb.create_sheet("Gov & Parity")
build_gov_sheet(ws_gov)

ws_patterns = wb.create_sheet("Architecture Patterns")
build_patterns_sheet(ws_patterns)

ws_controls = wb.create_sheet("NIST 800-53 Lens")
build_controls_sheet(ws_controls)

ws_up = wb.create_sheet("Upcoming & Future")
build_upcoming_sheet(ws_up)

out = OUTDIR / "Cloud_Intelligence_Matrix.xlsx"
wb.save(out)
print(f"✅ Saved: {out}  ({out.stat().st_size // 1024} KB)")
