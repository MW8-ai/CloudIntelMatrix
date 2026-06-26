import { useState, useMemo, useEffect } from "react";
import matrixData   from "../data/matrix.json";
import upcomingData from "../data/upcoming.json";
import historyData  from "../data/history.json";
import transparencyData from "../data/transparency.json";
import {
  controlExport,
  downloadCsv,
  downloadXlsx,
  historyExport,
  matrixExport,
  patternExport,
  printExport,
  transparencyExport,
} from "./exportHelpers";
import {
  GOV_AVAILABILITY_GLOSSARY,
  PARITY_LAG_GLOSSARY,
  getGovAvailabilityGlossary,
  getParityLagGlossary,
  getTagGlossary,
  glossaryTitle,
} from "./glossary";
import {
  PROVIDER_LABELS,
  buildDesignViewModel,
  groupRowsByLayer,
} from "./viewModels.mjs";

const {
  capabilities: CAPABILITIES,
  categories: CATEGORIES,
  tags: TAG_DEFS,
  frameworks: FRAMEWORKS,
  controlLens: CONTROL_LENS,
  complianceFrameworks: COMPLIANCE_FRAMEWORKS = [],
  patterns: PATTERNS,
  _meta: META,
} = matrixData;
const UPCOMING = upcomingData.upcoming || [];
const HISTORY = historyData.history || [];
const HISTORY_META = historyData._meta || {};
const TRANSPARENCY = transparencyData.mandates || [];
const TRANSPARENCY_META = transparencyData._meta || {};
const PROVIDERS = META.providers;
const CAPABILITY_MAP = Object.fromEntries(CAPABILITIES.map(cap => [cap.capability, cap]));
const DESIGN_MODEL = buildDesignViewModel({ matrixData, historyData, transparencyData, upcomingData });
const DESIGN_ROW_MAP = Object.fromEntries(DESIGN_MODEL.CIM_DATA.map(row => [row.cap, row]));

const THEME_STORAGE_KEY = "cloudintel-theme";
const DEFAULT_MODE = "matrix";
const DEFAULT_TIER = "Enterprise";
const DEFAULT_TRANSPARENCY_STATUS = "All";
const VALID_MODES = ["matrix", "patterns", "controls", "history", "transparency", "diff", "gov", "ai"];

const THEME_TOKENS = {
  light: {
    "--bg": "#f4f7fb",
    "--header-bg": "linear-gradient(180deg,#ffffff 0%,#eef3f8 100%)",
    "--panel": "#ffffff",
    "--panel-alt": "#edf3f9",
    "--text": "#172033",
    "--muted": "#556477",
    "--border": "#cfd8e3",
    "--link": "#0b62b9",
    "--selected-bg": "#dceeff",
    "--selected-text": "#064f9f",
    "--selected-border": "#0b62b9",
    "--category-bg": "#e7f1fb",
    "--category-text": "#17456f",
    "--tier-bg": "#eef6fd",
    "--verified-bg": "#dcfce7",
    "--verified-text": "#166534",
    "--verified-border": "#86efac",
    "--review-bg": "#f1f5f9",
    "--review-text": "#475569",
    "--review-border": "#cbd5e1",
  },
  dark: {
    "--bg": "#070b12",
    "--header-bg": "linear-gradient(180deg,#101827 0%,#070b12 100%)",
    "--panel": "#111827",
    "--panel-alt": "#0b1220",
    "--text": "#e7edf7",
    "--muted": "#9aa8ba",
    "--border": "#2a3a52",
    "--link": "#78aefc",
    "--selected-bg": "#102a46",
    "--selected-text": "#b8d7ff",
    "--selected-border": "#78aefc",
    "--category-bg": "#0d2035",
    "--category-text": "#b8d7ff",
    "--tier-bg": "#0d1c2d",
    "--verified-bg": "#052e16",
    "--verified-text": "#86efac",
    "--verified-border": "#166534",
    "--review-bg": "#111827",
    "--review-text": "#cbd5e1",
    "--review-border": "#475569",
  },
};

const VERIFICATION_REVIEW_WINDOW_DAYS = 180;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Ignore storage access errors and use the readable default.
  }
  return "light";
}

function getUrlSearchParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function getInitialMode() {
  const value = getUrlSearchParams().get("view");
  return VALID_MODES.includes(value) ? value : DEFAULT_MODE;
}

function getInitialProviders() {
  const value = getUrlSearchParams().get("providers");
  if (!value) return [...PROVIDERS];
  const selected = value.split(",").map(item => item.trim().toLowerCase()).filter(item => PROVIDERS.includes(item));
  const ordered = PROVIDERS.filter(provider => selected.includes(provider));
  return ordered.length ? ordered : [...PROVIDERS];
}

function getInitialCategory() {
  const value = getUrlSearchParams().get("category");
  return CATEGORIES.includes(value) ? value : null;
}

function getInitialSearchQuery() {
  return getUrlSearchParams().get("q") || "";
}

function getInitialTier() {
  const value = getUrlSearchParams().get("tier");
  if (value === "all") return null;
  return META.tiers.includes(value) ? value : DEFAULT_TIER;
}

function getInitialTransparencyStatus() {
  const value = getUrlSearchParams().get("state");
  return TRANSPARENCY_STATUS_ORDER.includes(value) ? value : DEFAULT_TRANSPARENCY_STATUS;
}

function syncFiltersToUrl({ mode, searchQuery, activeProviders, selectedCategory, selectedTier, selectedTransparencyStatus }) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (mode !== DEFAULT_MODE) params.set("view", mode);
  const q = searchQuery.trim();
  if (q) params.set("q", q);
  if (activeProviders.length !== PROVIDERS.length) params.set("providers", activeProviders.join(","));
  if (selectedCategory) params.set("category", selectedCategory);
  if (selectedTier === null) params.set("tier", "all");
  else if (selectedTier !== DEFAULT_TIER) params.set("tier", selectedTier);
  if (selectedTransparencyStatus !== DEFAULT_TRANSPARENCY_STATUS) params.set("state", selectedTransparencyStatus);

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) window.history.replaceState(null, "", nextUrl);
}

const PROVIDER_META = {
  aws:   { label: "AWS",   long: "Amazon Web Services",  dot: "#ff9900", bg: "#ff990011", border: "#ff990033" },
  azure: { label: "Azure", long: "Microsoft Azure",      dot: "#00b4d8", bg: "#00b4d811", border: "#00b4d833" },
  gcp:   { label: "GCP",   long: "Google Cloud",         dot: "#4285f4", bg: "#4285f411", border: "#4285f433" },
  oci:   { label: "OCI",   long: "Oracle Cloud Infrastructure", dot: "#c74634", bg: "#c7463411", border: "#c7463344" },
};

const GOV_AVAIL_STYLES = {
  "Full":        { bg: "#14532d", fg: "#4ade80", label: "GOV FULL" },
  "Partial":     { bg: "#78350f", fg: "#fbbf24", label: "GOV PARTIAL" },
  "Limited":     { bg: "#7c2d12", fg: "#fb923c", label: "GOV LIMITED" },
  "None":        { bg: "#1f2937", fg: "#6b7280", label: "GOV NONE" },
  "Unknown":     { bg: "#1f2937", fg: "#cbd5e1", label: "GOV UNKNOWN" },
};

const PARITY_STYLES = {
  "None":        { bg: "transparent", fg: "#374151", label: "" },
  "Minor":       { bg: "#78350f22", fg: "#f59e0b", label: "LAG MINOR" },
  "Moderate":    { bg: "#7f1d1d22", fg: "#f87171", label: "LAG MODERATE" },
  "Significant": { bg: "#7f1d1d44", fg: "#ef4444", label: "LAG SIGNIFICANT" },
  "Unknown":     { bg: "#1f293722", fg: "#94a3b8", label: "LAG UNKNOWN" },
};

const TAG_STYLES = {
  gray:   { bg: "#1f2937", fg: "#9ca3af", border: "#374151" },
  blue:   { bg: "#1e3a5f", fg: "#60a5fa", border: "#1d4ed8" },
  purple: { bg: "#1e3a5f", fg: "#93c5fd", border: "#2563eb" },
  green:  { bg: "#14532d", fg: "#4ade80", border: "#15803d" },
  amber:  { bg: "#78350f", fg: "#fbbf24", border: "#b45309" },
  red:    { bg: "#7f1d1d", fg: "#f87171", border: "#b91c1c" },
  cyan:   { bg: "#164e63", fg: "#22d3ee", border: "#0891b2" },
  slate:  { bg: "#1e293b", fg: "#94a3b8", border: "#334155" },
  teal:   { bg: "#134e4a", fg: "#2dd4bf", border: "#0d9488" },
  orange: { bg: "#7c2d12", fg: "#fb923c", border: "#c2410c" },
  yellow: { bg: "#713f12", fg: "#facc15", border: "#a16207" },
  rose:   { bg: "#881337", fg: "#fb7185", border: "#be123c" },
};

const HISTORY_PHASE_STYLES = {
  "Commercial cloud": { bg: "#1e3a5f22", fg: "#60a5fa", border: "#2563eb55" },
  "Personal / Free": { bg: "#14532d22", fg: "#22c55e", border: "#15803d55" },
  "Government state/federal": { bg: "#78350f22", fg: "#f59e0b", border: "#b4530955" },
};

const CATEGORY_ICON_META = {
  "Core Infrastructure": { kind: "server" },
  "Identity & Access": { kind: "key" },
  Networking: { kind: "network" },
  Storage: { kind: "bucket" },
  Databases: { kind: "database" },
  "Integration & Messaging": { kind: "arrows" },
  "Security & Compliance": { kind: "shield" },
  "Monitoring & Operations": { kind: "pulse" },
  "Data & Analytics": { kind: "bars" },
  "AI / ML": { kind: "nodes" },
  "Developer Platform": { kind: "code" },
  "Government / Sovereign Cloud": { kind: "building" },
  "Hybrid / Edge": { kind: "hybrid" },
  "Cost Governance": { kind: "cost" },
};

const DESIGN_LAYER_STYLES = {
  Foundation: { color: "#0b62b9", bg: "#0b62b914" },
  "Data & AI": { color: "#0f766e", bg: "#0f766e14" },
  "Apps & Integration": { color: "#b45309", bg: "#b4530914" },
  "Security & Governance": { color: "#b91c1c", bg: "#b91c1c12" },
  "Operating Model": { color: "#475569", bg: "#47556914" },
};

const COMPLIANCE_KIND_LABELS = {
  "authorization-program": "Authorization Programs",
  regulation: "Regulations",
  "validation-standard": "Validation Standards",
  "voluntary-framework": "AI & Voluntary Frameworks",
};

const COMPLIANCE_STATUS_STYLES = {
  Active: { bg: "#14532d22", fg: "#16a34a", border: "#15803d55" },
  Draft: { bg: "#78350f22", fg: "#d97706", border: "#b4530955" },
  "In development": { bg: "#164e6322", fg: "#0891b2", border: "#0891b255" },
  Superseded: { bg: "#1f293722", fg: "#64748b", border: "#64748b55" },
};

const TRANSPARENCY_STATUS_ORDER = ["All", "Active", "Proposed", "Repealed", "None on record", "Unknown"];

const TRANSPARENCY_STATUS_STYLES = {
  Active: { bg: "#14532d22", fg: "#16a34a", border: "#15803d55" },
  Proposed: { bg: "#78350f22", fg: "#d97706", border: "#b4530955" },
  Repealed: { bg: "#7f1d1d22", fg: "#dc2626", border: "#b91c1c55" },
  "None on record": { bg: "#1f293722", fg: "#64748b", border: "#64748b55" },
  Unknown: { bg: "#33415522", fg: "#64748b", border: "#64748b55" },
};

function GlossaryBadge({ label, description, styleDef, shape = "pill" }) {
  const [open, setOpen] = useState(false);
  const title = glossaryTitle(label, description);
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      aria-label={title}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setOpen(current => !current);
        }
      }}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: "fit-content",
        fontSize: 8,
        padding: shape === "pill" ? "2px 7px" : "2px 6px",
        borderRadius: shape === "pill" ? 10 : 3,
        fontWeight: 700,
        letterSpacing: shape === "pill" ? "0.07em" : "0.06em",
        background: styleDef.bg,
        color: styleDef.fg,
        border: `1px solid ${styleDef.border || `${styleDef.fg}33`}`,
        cursor: "help",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {open && (
        <span
          style={{
            position: "absolute",
            left: 0,
            bottom: "calc(100% + 6px)",
            width: 230,
            maxWidth: "min(70vw, 260px)",
            padding: "8px 9px",
            borderRadius: 4,
            border: "1px solid var(--border)",
            background: "var(--panel)",
            color: "var(--text)",
            boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
            fontSize: 10,
            fontWeight: 500,
            lineHeight: 1.45,
            letterSpacing: 0,
            textTransform: "none",
            whiteSpace: "normal",
            zIndex: 50,
          }}
        >
          <strong style={{ display: "block", color: "var(--link)", fontSize: 9, marginBottom: 3 }}>{label}</strong>
          {description}
        </span>
      )}
    </span>
  );
}

function TagBadge({ tagKey }) {
  const def = TAG_DEFS[tagKey];
  if (!def) return null;
  const glossary = getTagGlossary(TAG_DEFS, tagKey);
  const s = TAG_STYLES[def.color] || TAG_STYLES.gray;
  return (
    <GlossaryBadge label={glossary.label} description={glossary.description} styleDef={s} />
  );
}

function GovBadge({ avail }) {
  const s = GOV_AVAIL_STYLES[avail] || GOV_AVAIL_STYLES["None"];
  if (avail === "None") return null;
  const glossary = getGovAvailabilityGlossary(avail);
  return (
    <GlossaryBadge label={s.label} description={glossary.description} styleDef={s} shape="block" />
  );
}

function ParityBadge({ parity }) {
  if (!parity || parity === "None") return null;
  const s = PARITY_STYLES[parity] || PARITY_STYLES["Minor"];
  const glossary = getParityLagGlossary(parity);
  return (
    <GlossaryBadge label={s.label} description={glossary.description} styleDef={s} shape="block" />
  );
}

function ComplianceStatusBadge({ status }) {
  const style = COMPLIANCE_STATUS_STYLES[status] || COMPLIANCE_STATUS_STYLES.Active;
  return (
    <span style={{ fontSize: 8, padding: "3px 7px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.06em", background: style.bg, color: style.fg, border: `1px solid ${style.border}`, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function TransparencyStatusBadge({ status }) {
  const style = TRANSPARENCY_STATUS_STYLES[status] || TRANSPARENCY_STATUS_STYLES.Unknown;
  return (
    <span style={{ fontSize: 8, padding: "3px 7px", borderRadius: 4, fontWeight: 700, letterSpacing: "0.06em", background: style.bg, color: style.fg, border: `1px solid ${style.border}`, whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function getVerificationState(date) {
  if (!date) {
    return {
      label: "REVIEW NEEDED",
      icon: "!",
      tone: "review",
      title: "No lastVerified date is recorded for this item.",
    };
  }

  const verifiedAt = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(verifiedAt.getTime())) {
    return {
      label: `REVIEW ${date}`,
      icon: "!",
      tone: "review",
      title: `The recorded lastVerified value (${date}) is not a valid ISO date.`,
    };
  }

  const ageDays = Math.floor((Date.now() - verifiedAt.getTime()) / MS_PER_DAY);
  if (ageDays >= 0 && ageDays <= VERIFICATION_REVIEW_WINDOW_DAYS) {
    return {
      label: `VERIFIED ${date}`,
      icon: "✓",
      tone: "verified",
      title: `Official-source review recorded on ${date}; inside the ${VERIFICATION_REVIEW_WINDOW_DAYS}-day review window.`,
    };
  }

  return {
    label: `REVIEW ${date}`,
    icon: "!",
    tone: "review",
    title: `Official-source review recorded on ${date}; outside the ${VERIFICATION_REVIEW_WINDOW_DAYS}-day review window.`,
  };
}

function VerificationPill({ state, label, icon, title }) {
  const tone = state === "verified" ? "verified" : "review";
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        width: "fit-content",
        fontSize: 8,
        color: `var(--${tone}-text)`,
        background: `var(--${tone}-bg)`,
        border: `1px solid var(--${tone}-border)`,
        borderRadius: 4,
        padding: "3px 6px",
        letterSpacing: "0.06em",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 9, lineHeight: 1 }}>{icon}</span>
      {label}
    </span>
  );
}

function VerifiedStamp({ date }) {
  const state = getVerificationState(date);
  return (
    <VerificationPill state={state.tone} label={state.label} icon={state.icon} title={state.title} />
  );
}

function CategoryIcon({ category, size = 14 }) {
  const kind = CATEGORY_ICON_META[category]?.kind || "server";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    style: { flexShrink: 0 },
  };
  const shapes = {
    server: <><rect x="4" y="5" width="16" height="6" rx="1.5" /><rect x="4" y="13" width="16" height="6" rx="1.5" /><path d="M7 8h.01M7 16h.01" /></>,
    key: <><circle cx="8" cy="12" r="3" /><path d="M11 12h9M16 12v3M19 12v2" /></>,
    network: <><circle cx="6" cy="7" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="17" r="2" /><path d="M8 8l3 7M16 8l-3 7M8 7h8" /></>,
    bucket: <><path d="M5 7c0 2 14 2 14 0" /><path d="M5 7l1.5 11c.5 2 10.5 2 11 0L19 7" /><path d="M7 11c3 1 7 1 10 0" /></>,
    database: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
    arrows: <><path d="M4 7h12" /><path d="M13 4l3 3-3 3" /><path d="M20 17H8" /><path d="M11 14l-3 3 3 3" /></>,
    shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-5" /></>,
    pulse: <><path d="M3 12h4l2-5 4 10 2-5h6" /></>,
    bars: <><path d="M5 19V9" /><path d="M12 19V5" /><path d="M19 19v-7" /><path d="M4 19h16" /></>,
    nodes: <><circle cx="6" cy="12" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="18" cy="17" r="2" /><path d="M8 12l8-5M8 12l8 5" /></>,
    code: <><path d="M8 8l-4 4 4 4" /><path d="M16 8l4 4-4 4" /><path d="M14 5l-4 14" /></>,
    building: <><path d="M4 20h16" /><path d="M6 20V9l6-4 6 4v11" /><path d="M9 20v-6h6v6" /><path d="M9 10h.01M12 10h.01M15 10h.01" /></>,
    hybrid: <><rect x="3" y="6" width="7" height="7" rx="1" /><rect x="14" y="11" width="7" height="7" rx="1" /><path d="M10 10h4M12 8v6" /></>,
    cost: <><circle cx="12" cy="12" r="8" /><path d="M12 7v10M15 9.5c-.8-.7-1.8-1-3-1-1.7 0-3 .8-3 2s1.3 2 3 2 3 .8 3 2-1.3 2-3 2c-1.2 0-2.3-.3-3-1" /></>,
  };
  return <svg {...common}>{shapes[kind] || shapes.server}</svg>;
}

function CategoryLabel({ category, size = 14, uppercase = false, style = {} }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0, ...style }}>
      <CategoryIcon category={category} size={size} />
      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{uppercase ? category.toUpperCase() : category}</span>
    </span>
  );
}

function GovAvailabilityGlossaryLegend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700 }}>GOV AVAILABILITY</span>
      {Object.keys(GOV_AVAILABILITY_GLOSSARY).map(value => {
        const baseStyle = GOV_AVAIL_STYLES[value] || GOV_AVAIL_STYLES.Unknown;
        const styleDef = ["None", "Unknown"].includes(value)
          ? { bg: "var(--panel-alt)", fg: "var(--muted)", border: "var(--border)" }
          : baseStyle;
        const glossary = getGovAvailabilityGlossary(value);
        return (
          <GlossaryBadge
            key={value}
            label={baseStyle.label}
            description={glossary.description}
            styleDef={styleDef}
            shape="block"
          />
        );
      })}
    </div>
  );
}

function ParityLagGlossaryLegend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700 }}>PARITY LAG</span>
      {Object.keys(PARITY_LAG_GLOSSARY).map(value => {
        const styleDef = value === "None"
          ? { bg: "var(--panel-alt)", fg: "var(--muted)", border: "var(--border)" }
          : PARITY_STYLES[value] || PARITY_STYLES.Unknown;
        const glossary = getParityLagGlossary(value);
        return (
          <GlossaryBadge
            key={value}
            label={styleDef.label || "LAG NONE"}
            description={glossary.description}
            styleDef={styleDef}
            shape="block"
          />
        );
      })}
    </div>
  );
}

// ── CAPABILITY ROW ─────────────────────────────────────────────────────────
function ExportToolbar({ exportData }) {
  const disabled = !exportData?.rows?.length;
  const buttonStyle = {
    padding: "5px 9px",
    borderRadius: 4,
    border: "1px solid var(--border)",
    background: disabled ? "var(--panel-alt)" : "var(--panel)",
    color: disabled ? "var(--muted)" : "var(--text)",
    fontSize: 9,
    fontWeight: 700,
    fontFamily: "inherit",
    letterSpacing: "0.05em",
  };

  return (
    <div className="export-toolbar" style={{ marginBottom: 12, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 9, color: "var(--link)", fontWeight: 700, letterSpacing: "0.1em" }}>EXPORT VISIBLE VIEW</div>
        <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>{exportData.label} - {exportData.rows.length} row(s)</div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button className="hb" disabled={disabled} onClick={() => downloadCsv(exportData)} style={buttonStyle}>CSV</button>
        <button className="hb" disabled={disabled} onClick={() => downloadXlsx(exportData)} style={buttonStyle}>XLSX</button>
        <button className="hb" disabled={disabled} onClick={() => printExport(exportData)} style={buttonStyle}>PDF</button>
      </div>
    </div>
  );
}

function PrintableExport({ exportData }) {
  return (
    <section className="print-export" aria-hidden="true">
      <h1>CloudIntelMatrix - {exportData.label}</h1>
      <p>Generated {exportData.generatedOn}. Visible filtered rows only. Official-source matrix data remains the source of truth.</p>
      <table>
        <thead>
          <tr>
            {exportData.columns.map(column => <th key={column}>{column}</th>)}
          </tr>
        </thead>
        <tbody>
          {exportData.rows.length ? exportData.rows.map((row, index) => (
            <tr key={index}>
              {exportData.columns.map(column => (
                <td key={column}>{Array.isArray(row[column]) ? row[column].join("; ") : row[column] ?? ""}</td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={exportData.columns.length}>No rows match the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function CapabilityRow({ cap, activeProviders, expandedId, setExpandedId, tier }) {
  const isExpanded = expandedId === cap.capability;

  return (
    <div style={{ marginBottom: 10 }}>
      {/* Main row */}
      <div style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 8 }}>
        {/* Capability label */}
        <div
          onClick={() => setExpandedId(isExpanded ? null : cap.capability)}
          style={{ padding: "10px 12px", borderRadius: 4, border: `1px solid ${isExpanded ? "var(--link)" : "var(--border)"}`, borderLeft: `3px solid ${isExpanded ? "var(--link)" : "var(--selected-border)"}`, background: isExpanded ? "var(--panel-alt)" : "var(--panel)", cursor: "pointer", minHeight: 88 }}
        >
          <div style={{ display: "inline-flex", maxWidth: "100%", padding: "2px 6px", borderRadius: 3, border: "1px solid var(--border)", background: "var(--category-bg)", color: "var(--category-text)", fontSize: 8, letterSpacing: "0.08em", marginBottom: 6, fontWeight: 700 }}>
            <CategoryLabel category={cap.category} size={11} uppercase />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 8 }}>{cap.capability}</div>
          {/* Tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
            {cap.tags.map(t => <TagBadge key={t} tagKey={t} />)}
          </div>
          <VerifiedStamp date={cap.lastVerified} />
        </div>

        {/* Provider cells */}
        {activeProviders.map(provKey => {
          const prov = cap.providers[provKey];
          const pm = PROVIDER_META[provKey];
          if (!prov) return <div key={provKey} style={{ background: "var(--panel)", borderRadius: 4, border: "1px solid var(--border)" }} />;
          return (
            <div
              key={provKey}
              onClick={() => setExpandedId(isExpanded ? null : cap.capability)}
              style={{ padding: "10px 14px", borderRadius: 4, border: `1px solid ${isExpanded ? pm.border : "var(--border)"}`, borderTop: tier ? "3px solid var(--selected-border)" : `1px solid ${isExpanded ? pm.border : "var(--border)"}`, background: isExpanded ? pm.bg : "var(--panel)", cursor: "pointer", minHeight: 88 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, flex: 1 }}>{prov.service}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <GovBadge avail={prov.govAvailability} />
                <ParityBadge parity={prov.parityLag} />
              </div>
              {tier && prov.tierNotes?.[tier] && (
                <div style={{ fontSize: 9, color: "var(--text)", marginTop: 8, lineHeight: 1.45, padding: "6px 8px", borderLeft: "2px solid var(--selected-border)", background: "var(--tier-bg)" }}>
                  <span style={{ color: "var(--selected-text)", fontWeight: 700 }}>{tier}: </span>{prov.tierNotes[tier]}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div style={{ marginTop: 4, padding: "14px 16px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--panel-alt)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--link)", marginBottom: 5 }}>ARCHITECTURE NOTES</div>
              <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>{cap.architectureNotes}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#f59e0b", marginBottom: 5 }}>OPERATIONAL CONSIDERATIONS</div>
              <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>{cap.operationalConsiderations}</div>
            </div>
          </div>

          {/* Per-provider detail */}
          <div style={{ display: "grid", gridTemplateColumns: activeProviders.map(() => "1fr").join(" "), gap: 12 }}>
            {activeProviders.map(provKey => {
              const prov = cap.providers[provKey];
              const pm = PROVIDER_META[provKey];
              if (!prov) return <div key={provKey} />;
              return (
                <div key={provKey} style={{ padding: "10px 12px", borderRadius: 4, border: `1px solid ${pm.border}`, background: pm.bg }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: pm.dot, marginBottom: 6 }}>{pm.label} — {prov.service}</div>
                  {prov.formerNames?.length > 0 && (
                    <div style={{ fontSize: 8, color: "var(--muted)", lineHeight: 1.45, marginBottom: 7 }}>
                      <span style={{ color: "var(--text)", fontWeight: 700 }}>Formerly: </span>{prov.formerNames.join(" / ")}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
                    <GovBadge avail={prov.govAvailability} />
                    <ParityBadge parity={prov.parityLag} />
                    {prov.govVariant && <span style={{ fontSize: 8, color: "var(--muted)" }}>{prov.govVariant}</span>}
                  </div>
                  {/* Links */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {prov.docsUrl && <a href={prov.docsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>↗ Docs</a>}
                    {prov.pricingUrl && <a href={prov.pricingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>↗ Pricing</a>}
                    {prov.complianceUrl && <a href={prov.complianceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#22d3ee", textDecoration: "none" }}>↗ Compliance</a>}
                    {prov.govDocsUrl && <a href={prov.govDocsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#4ade80", textDecoration: "none" }}>↗ Gov Docs</a>}
                  </div>
                  {/* Tier notes */}
                  {prov.tierNotes && (
                    <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                      {Object.entries(prov.tierNotes).map(([t, note]) => (
                        <div key={t} style={{ marginBottom: 4 }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.06em" }}>{t.toUpperCase()}: </span>
                          <span style={{ fontSize: 9, color: "var(--muted)" }}>{note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// -- DESIGN MATRIX VIEW -----------------------------------------------------
function providerLabelForKey(providerKey) {
  return PROVIDER_LABELS[providerKey] || PROVIDER_META[providerKey]?.label || providerKey;
}

function getDesignGovStyle(value) {
  const base = GOV_AVAIL_STYLES[value] || GOV_AVAIL_STYLES.Unknown;
  if (value === "Unknown" || value === "None") {
    return { bg: "var(--panel-alt)", fg: "var(--muted)", border: "var(--border)", label: base.label };
  }
  return base;
}

function MatrixCoverageStrip({ rows, activeProviders }) {
  const statuses = ["Full", "Partial", "Limited", "Unknown", "None"];

  return (
    <div className="design-coverage-strip">
      {activeProviders.map(providerKey => {
        const label = providerLabelForKey(providerKey);
        const counts = Object.fromEntries(statuses.map(status => [status, 0]));
        rows.forEach(row => {
          const status = row.providers?.[label]?.gov || "Unknown";
          counts[status] = (counts[status] || 0) + 1;
        });
        const total = rows.length || 1;
        const documented = counts.Full + counts.Partial + counts.Limited;

        return (
          <div key={providerKey} className="design-coverage-card" style={{ borderColor: PROVIDER_META[providerKey].border }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ color: PROVIDER_META[providerKey].dot, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em" }}>{label}</div>
              <div style={{ color: "var(--text)", fontSize: 12, fontWeight: 800 }}>{Math.round((documented / total) * 100)}%</div>
            </div>
            <div style={{ display: "flex", height: 7, overflow: "hidden", borderRadius: 999, background: "var(--panel-alt)", border: "1px solid var(--border)", marginTop: 8 }}>
              {statuses.map(status => {
                const style = getDesignGovStyle(status);
                return (
                  <span
                    key={status}
                    title={`${status}: ${counts[status] || 0}`}
                    style={{
                      width: `${((counts[status] || 0) / total) * 100}%`,
                      minWidth: counts[status] ? 3 : 0,
                      background: style.fg,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 9, lineHeight: 1.45, marginTop: 7 }}>
              {documented} of {rows.length} documented. {counts.Full} full / {counts.Partial} scoped / {counts.Limited} gaps.
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DesignProviderCell({ row, providerKey, selected, onSelect, tier }) {
  const label = providerLabelForKey(providerKey);
  const provider = row.providers?.[label];
  const pm = PROVIDER_META[providerKey];
  if (!provider) {
    return <div className="design-provider-cell" style={{ borderColor: "var(--border)" }} />;
  }

  const govStyle = getDesignGovStyle(provider.gov);
  const tierNote = tier ? provider.tierNotes?.[tier] : null;

  return (
    <button
      className="hb design-provider-cell"
      type="button"
      onClick={onSelect}
      aria-label={`${row.cap} ${label} detail`}
      style={{
        borderColor: selected ? pm.dot : "var(--border)",
        background: selected ? pm.bg : "var(--panel)",
        color: "var(--text)",
      }}
    >
      <span style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", color: pm.dot, fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", marginBottom: 4 }}>{label}</span>
          <span style={{ display: "block", fontSize: 11, fontWeight: 700, lineHeight: 1.35, overflowWrap: "anywhere" }}>{provider.svc || "Not mapped"}</span>
        </span>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, background: govStyle.fg, flexShrink: 0, marginTop: 2 }} />
      </span>
      <span style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 9 }}>
        <GovBadge avail={provider.gov} />
        <ParityBadge parity={provider.lag} />
      </span>
      {tierNote && (
        <span style={{ display: "block", marginTop: 9, padding: "6px 8px", borderLeft: "2px solid var(--selected-border)", background: "var(--tier-bg)", color: "var(--text)", fontSize: 9, lineHeight: 1.45 }}>
          <strong style={{ color: "var(--selected-text)" }}>{tier}: </strong>{tierNote}
        </span>
      )}
    </button>
  );
}

function DesignMatrixDetail({ row, activeProviders, tier }) {
  if (!row) {
    return (
      <aside className="design-detail-panel">
        <div style={{ fontSize: 9, color: "var(--link)", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 8 }}>DETAIL</div>
        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 800, marginBottom: 7 }}>Select a capability</div>
        <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>Click any matrix cell to inspect service mapping, government availability, parity lag, source notes, and official links.</div>
      </aside>
    );
  }

  return (
    <aside className="design-detail-panel">
      <div style={{ display: "inline-flex", maxWidth: "100%", padding: "3px 7px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--category-bg)", color: "var(--category-text)", fontSize: 8, letterSpacing: "0.08em", marginBottom: 8, fontWeight: 800 }}>
        <CategoryLabel category={row.cat} size={12} uppercase />
      </div>
      <div style={{ fontSize: 15, color: "var(--text)", fontWeight: 800, lineHeight: 1.25, marginBottom: 8 }}>{row.cap}</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {row.tags.map(tag => <TagBadge key={tag} tagKey={tag} />)}
      </div>
      <VerifiedStamp date={row.lastVerified} />

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        <div>
          <div style={{ fontSize: 8, color: "var(--link)", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 4 }}>ARCHITECTURE NOTE</div>
          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>{row.architectureNotes}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: "var(--link)", fontWeight: 800, letterSpacing: "0.1em", marginBottom: 4 }}>OPERATIONS NOTE</div>
          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>{row.operationalConsiderations}</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {activeProviders.map(providerKey => {
          const label = providerLabelForKey(providerKey);
          const provider = row.providers?.[label];
          const pm = PROVIDER_META[providerKey];
          if (!provider) return null;
          const tierNote = tier ? provider.tierNotes?.[tier] : null;

          return (
            <div key={providerKey} style={{ padding: "10px 11px", borderRadius: 6, border: `1px solid ${pm.border}`, background: pm.bg }}>
              <div style={{ color: pm.dot, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", marginBottom: 5 }}>{label}</div>
              <div style={{ color: "var(--text)", fontSize: 11, fontWeight: 800, lineHeight: 1.35 }}>{provider.svc || "Not mapped"}</div>
              {provider.formerNames?.length > 0 && (
                <div style={{ color: "var(--muted)", fontSize: 8, lineHeight: 1.45, marginTop: 5 }}>
                  <strong style={{ color: "var(--text)" }}>Formerly: </strong>{provider.formerNames.join(" / ")}
                </div>
              )}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                <GovBadge avail={provider.gov} />
                <ParityBadge parity={provider.lag} />
              </div>
              <div style={{ color: "var(--muted)", fontSize: 9, lineHeight: 1.5, marginTop: 8 }}>
                <strong style={{ color: "var(--text)" }}>Variant: </strong>{provider.variant || "Not recorded"}
              </div>
              {provider.note && (
                <div style={{ color: "var(--muted)", fontSize: 9, lineHeight: 1.5, marginTop: 6 }}>{provider.note}</div>
              )}
              {tierNote && (
                <div style={{ color: "var(--text)", fontSize: 9, lineHeight: 1.45, marginTop: 8, padding: "6px 8px", borderLeft: "2px solid var(--selected-border)", background: "var(--tier-bg)" }}>
                  <strong style={{ color: "var(--selected-text)" }}>{tier}: </strong>{tierNote}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {provider.doc && <a href={provider.doc} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>Docs</a>}
                {provider.price && <a href={provider.price} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>Pricing</a>}
                {provider.compliance && <a href={provider.compliance} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>Compliance</a>}
                {provider.govdoc && <a href={provider.govdoc} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>Gov docs</a>}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function DesignMatrixView({ rows, activeProviders, selectedId, setSelectedId, tier }) {
  const groupedLayers = useMemo(() => groupRowsByLayer(rows), [rows]);
  const selectedRow = rows.find(row => row.cap === selectedId) || null;
  const gridTemplateColumns = `minmax(240px, 1.15fr) ${activeProviders.map(() => "minmax(170px, 1fr)").join(" ")}`;

  if (!rows.length) {
    return (
      <div style={{ padding: "22px 0", fontSize: 10, color: "var(--muted)" }}>
        No capability rows match the current filters.
      </div>
    );
  }

  return (
    <div className="design-matrix-shell">
      <div style={{ minWidth: activeProviders.length > 3 ? 980 : 760 }}>
        <div style={{ marginBottom: 14, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, color: "var(--link)", fontWeight: 800, letterSpacing: "0.12em", marginBottom: 4 }}>CAPABILITY MATRIX</div>
              <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 800, lineHeight: 1.25 }}>Layered architecture view by provider</div>
              <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.55, marginTop: 5, maxWidth: 760 }}>
                Grouped into architecture layers, then source categories. Cells show mapped service, government availability, parity lag, and selected tier guidance.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 800 }}>VISIBLE</span>
              <span style={{ fontSize: 10, color: "var(--text)", fontWeight: 800 }}>{rows.length} capabilities</span>
              {tier && <span style={{ fontSize: 10, color: "var(--selected-text)", fontWeight: 800 }}>Tier: {tier}</span>}
            </div>
          </div>
          <MatrixCoverageStrip rows={rows} activeProviders={activeProviders} />
        </div>

        <div className="design-matrix-grid" style={{ gridTemplateColumns }}>
          <div className="design-grid-head">Capability</div>
          {activeProviders.map(providerKey => (
            <div key={providerKey} className="design-grid-head" style={{ borderColor: PROVIDER_META[providerKey].border, background: PROVIDER_META[providerKey].bg }}>
              <div style={{ color: PROVIDER_META[providerKey].dot, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em" }}>{PROVIDER_META[providerKey].label}</div>
              <div style={{ color: "var(--muted)", fontSize: 8, marginTop: 2 }}>{PROVIDER_META[providerKey].long}</div>
            </div>
          ))}
        </div>

        {groupedLayers.map(layer => {
          const layerStyle = DESIGN_LAYER_STYLES[layer.layer] || DESIGN_LAYER_STYLES["Operating Model"];
          const layerCount = layer.categories.reduce((total, category) => total + category.items.length, 0);

          return (
            <section key={layer.layer} style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 12px", borderTop: `2px solid ${layerStyle.color}`, borderBottom: "1px solid var(--border)", background: layerStyle.bg, color: "var(--text)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: layerStyle.color }} />
                  <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>{layer.layer}</span>
                </div>
                <span style={{ fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>{layerCount} capability row(s)</span>
              </div>

              {layer.categories.map(category => (
                <div key={category.category}>
                  <div style={{ marginTop: 9, marginBottom: 7, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: "var(--category-text)" }}>
                    <CategoryLabel category={category.category} size={15} uppercase style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em" }} />
                    <span style={{ color: "var(--muted)", fontSize: 9 }}>{category.items.length}</span>
                  </div>
                  <div style={{ display: "grid", gap: 7 }}>
                    {category.items.map(row => {
                      const selected = selectedId === row.cap;
                      return (
                        <div key={row.cap} className="design-matrix-grid" style={{ gridTemplateColumns }}>
                          <button
                            className="hb design-capability-cell"
                            type="button"
                            onClick={() => setSelectedId(selected ? null : row.cap)}
                            aria-label={`${row.cap} detail`}
                            style={{
                              borderColor: selected ? "var(--link)" : "var(--border)",
                              background: selected ? "var(--selected-bg)" : "var(--panel)",
                              color: "var(--text)",
                            }}
                          >
                            <span style={{ display: "block", fontSize: 12, fontWeight: 800, lineHeight: 1.3, marginBottom: 7 }}>{row.cap}</span>
                            <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 7 }}>
                              {row.tags.slice(0, 4).map(tag => <TagBadge key={tag} tagKey={tag} />)}
                            </span>
                            <VerifiedStamp date={row.lastVerified} />
                          </button>
                          {activeProviders.map(providerKey => (
                            <DesignProviderCell
                              key={providerKey}
                              row={row}
                              providerKey={providerKey}
                              selected={selected}
                              onSelect={() => setSelectedId(row.cap)}
                              tier={tier}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <DesignMatrixDetail row={selectedRow} activeProviders={activeProviders} tier={tier} />
    </div>
  );
}

function ViewHero({ eyebrow, title, body, meta }) {
  return (
    <div className="design-view-hero">
      <div>
        <div style={{ fontSize: 9, color: "var(--link)", fontWeight: 800, letterSpacing: "0.12em", marginBottom: 4 }}>{eyebrow}</div>
        <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 800, lineHeight: 1.25 }}>{title}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6, marginTop: 6, maxWidth: 880 }}>{body}</div>
      </div>
      {meta && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" }}>
          {meta}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, tone = "var(--link)" }) {
  return (
    <div style={{ minWidth: 88, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel-alt)", textAlign: "center" }}>
      <div style={{ fontSize: 15, color: tone, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.08em", fontWeight: 800, marginTop: 5 }}>{label}</div>
    </div>
  );
}

function ProviderServiceTile({ providerKey, provider, showLinks = false, showGovVariant = false, showGovLinks = false }) {
  const pm = PROVIDER_META[providerKey];
  if (!provider) return null;

  return (
    <div className="design-provider-tile" style={{ borderColor: pm.border, background: pm.bg }}>
      <div style={{ color: pm.dot, fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 5 }}>{pm.label}</div>
      <div style={{ color: "var(--text)", fontSize: 11, fontWeight: 800, lineHeight: 1.35, marginBottom: 8 }}>{provider.service}</div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <GovBadge avail={provider.govAvailability} />
        <ParityBadge parity={provider.parityLag} />
      </div>
      {showGovVariant && (
        <div style={{ color: "var(--muted)", fontSize: 9, lineHeight: 1.45, marginTop: 7 }}>
          {provider.govVariant || "No gov variant recorded"}
        </div>
      )}
      {showLinks && provider.docsUrl && (
        <a href={provider.docsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, color: "var(--link)", fontSize: 9, fontWeight: 700, textDecoration: "none" }}>
          Docs
        </a>
      )}
      {showGovLinks && provider.govDocsUrl && (
        <a href={provider.govDocsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: showLinks && provider.docsUrl ? 5 : 8, marginLeft: showLinks && provider.docsUrl ? 8 : 0, color: "var(--link)", fontSize: 9, fontWeight: 700, textDecoration: "none" }}>
          Gov docs
        </a>
      )}
    </div>
  );
}

// -- GOV FOCUS VIEW ---------------------------------------------------------

// ── AI FOCUS VIEW ──────────────────────────────────────────────────────────
function GovViewDesign({ caps, activeProviders }) {
  const reviewRows = caps.filter(cap =>
    activeProviders.some(providerKey => {
      const provider = cap.providers[providerKey];
      return provider && (provider.govAvailability !== "Full" || (provider.parityLag && provider.parityLag !== "None"));
    })
  );
  const providerCounts = activeProviders.map(providerKey => ({
    providerKey,
    reviewCount: caps.filter(cap => {
      const provider = cap.providers[providerKey];
      return provider && (provider.govAvailability !== "Full" || (provider.parityLag && provider.parityLag !== "None"));
    }).length,
  }));

  return (
    <div>
      <ViewHero
        eyebrow="GOVERNMENT & PARITY"
        title="Regulated-region availability and parity review"
        body="This view surfaces govAvailability, parityLag, and govVariant values without inferring parity from commercial availability. Unknown remains an honest value until an official government or regulated-environment source supports a stronger claim."
        meta={[
          <StatTile key="rows" label="ROWS" value={caps.length} />,
          <StatTile key="review" label="REVIEW ROWS" value={reviewRows.length} tone="#b45309" />,
          <StatTile key="providers" label="PROVIDERS" value={activeProviders.length} />,
        ]}
      />

      <div className="design-provider-tile-grid" style={{ gridTemplateColumns: activeProviders.map(() => "minmax(160px, 1fr)").join(" "), marginBottom: 14 }}>
        {providerCounts.map(({ providerKey, reviewCount }) => {
          const pm = PROVIDER_META[providerKey];
          return (
            <div key={providerKey} className="design-provider-tile" style={{ borderColor: pm.border, background: pm.bg }}>
              <div style={{ color: pm.dot, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 6 }}>{pm.label}</div>
              <div style={{ color: "var(--text)", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{reviewCount}</div>
              <div style={{ color: "var(--muted)", fontSize: 9, lineHeight: 1.45, marginTop: 5 }}>capability/provider cells with gov or parity review flags</div>
            </div>
          );
        })}
      </div>

      {!caps.length && (
        <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No government availability rows match the current filter.</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {caps.map(cap => {
          const highlightedTags = cap.tags.filter(tag => ["GOV_AVAILABLE", "GOV_LIMITED", "PARITY_LAG", "COMPLIANCE_RELEVANT"].includes(tag));
          return (
            <article key={cap.capability} className="design-secondary-card">
              <div className="design-secondary-card-head">
                <div>
                  <CategoryLabel category={cap.category} size={14} uppercase style={{ color: "var(--category-text)", fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 6 }} />
                  <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 900, lineHeight: 1.25 }}>{cap.capability}</div>
                  <div style={{ color: "var(--muted)", fontSize: 10, lineHeight: 1.55, marginTop: 6 }}>{cap.architectureNotes}</div>
                </div>
                <div style={{ display: "flex", gap: 5, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {highlightedTags.map(tag => <TagBadge key={tag} tagKey={tag} />)}
                  <VerifiedStamp date={cap.lastVerified} />
                </div>
              </div>
              <div className="design-provider-tile-grid" style={{ gridTemplateColumns: activeProviders.map(() => "minmax(165px, 1fr)").join(" ") }}>
                {activeProviders.map(providerKey => (
                  <ProviderServiceTile
                    key={providerKey}
                    providerKey={providerKey}
                    provider={cap.providers[providerKey]}
                    showGovVariant
                    showGovLinks
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}


// ── DIFF VIEW ──────────────────────────────────────────────────────────────
function AIViewDesign({ caps, activeProviders }) {
  const aiCaps = caps.filter(c => c.tags.some(t => ["AI_NATIVE","AI_CAPABLE"].includes(t)));
  const groups = [
    {
      key: "AI_NATIVE",
      label: "AI-native",
      note: "Purpose-built AI and machine-learning services.",
      tone: "#0f766e",
    },
    {
      key: "AI_CAPABLE",
      label: "AI-capable",
      note: "Services that directly support AI workloads without being the AI product itself.",
      tone: "#0b62b9",
    },
  ].map(group => ({
    ...group,
    items: aiCaps.filter(cap => cap.tags.includes(group.key)),
  }));

  return (
    <div>
      <ViewHero
        eyebrow="AI FOCUS"
        title="AI-native and AI-capable services by provider"
        body="AI_NATIVE means the capability is itself an AI product. AI_CAPABLE means the capability directly supports AI workloads. Government availability and parity are still fact fields, not inferred from commercial launch status."
        meta={[
          <StatTile key="native" label="AI_NATIVE" value={groups.find(group => group.key === "AI_NATIVE")?.items.length || 0} tone="#0f766e" />,
          <StatTile key="capable" label="AI_CAPABLE" value={groups.find(group => group.key === "AI_CAPABLE")?.items.length || 0} tone="#0b62b9" />,
        ]}
      />
      {!aiCaps.length && (
        <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No AI-focused capabilities match the current filter.</div>
      )}
      {groups.filter(group => group.items.length).map(group => (
        <section key={group.key} style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 12px", borderTop: `2px solid ${group.tone}`, borderBottom: "1px solid var(--border)", background: `${group.tone}14` }}>
            <div>
              <div style={{ color: "var(--text)", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>{group.label}</div>
              <div style={{ color: "var(--muted)", fontSize: 9, marginTop: 3 }}>{group.note}</div>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 9, fontWeight: 800 }}>{group.items.length} row(s)</span>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {group.items.map(cap => (
              <div key={cap.capability} className="design-secondary-card">
                <div className="design-secondary-card-head">
                  <div>
                    <CategoryLabel category={cap.category} size={14} uppercase style={{ color: "var(--category-text)", fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 6 }} />
                    <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 900, lineHeight: 1.25 }}>{cap.capability}</div>
                    <div style={{ color: "var(--muted)", fontSize: 10, lineHeight: 1.55, marginTop: 6 }}>{cap.architectureNotes}</div>
                  </div>
                  <div style={{ display: "flex", gap: 5, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <TagBadge tagKey={group.key} />
                    <VerifiedStamp date={cap.lastVerified} />
                  </div>
                </div>
                <div className="design-provider-tile-grid" style={{ gridTemplateColumns: activeProviders.map(() => "minmax(160px, 1fr)").join(" ") }}>
                  {activeProviders.map(providerKey => (
                    <ProviderServiceTile key={providerKey} providerKey={providerKey} provider={cap.providers[providerKey]} showLinks />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}


// ── ARCHITECTURE PATTERN VIEW ──────────────────────────────────────────────
function DiffViewDesign({ caps, activeProviders }) {
  const categories = Array.from(new Set(caps.map(cap => cap.category)));

  return (
    <div>
      <ViewHero
        eyebrow="SERVICE EQUIVALENCY"
        title="Side-by-side provider service mapping"
        body="Equivalency maps the provider services that perform the same capability-level job. This is a planning map, not a feature parity claim; gov availability and parity fields remain separate factual signals."
        meta={[
          <StatTile key="rows" label="ROWS" value={caps.length} />,
          <StatTile key="categories" label="CATEGORIES" value={categories.length} />,
          <StatTile key="providers" label="PROVIDERS" value={activeProviders.length} />,
        ]}
      />

      {!caps.length && (
        <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No equivalency rows match the current filter.</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {caps.map(cap => (
          <article key={cap.capability} className="design-secondary-card">
            <div className="design-secondary-card-head">
              <div>
                <CategoryLabel category={cap.category} size={14} uppercase style={{ color: "var(--category-text)", fontSize: 9, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 6 }} />
                <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 900, lineHeight: 1.25 }}>{cap.capability}</div>
                <div style={{ color: "var(--muted)", fontSize: 10, lineHeight: 1.55, marginTop: 6 }}>{cap.architectureNotes}</div>
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {cap.tags.slice(0, 3).map(tag => <TagBadge key={tag} tagKey={tag} />)}
                <VerifiedStamp date={cap.lastVerified} />
              </div>
            </div>
            <div className="design-provider-tile-grid" style={{ gridTemplateColumns: activeProviders.map(() => "minmax(165px, 1fr)").join(" ") }}>
              {activeProviders.map(providerKey => (
                <ProviderServiceTile
                  key={providerKey}
                  providerKey={providerKey}
                  provider={cap.providers[providerKey]}
                  showLinks
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}


// -- COMPLIANCE LENS -------------------------------------------------------
function PatternViewDesign({ patterns, activeProviders }) {
  const [expandedPatternId, setExpandedPatternId] = useState(patterns[0]?.id || null);

  if (!patterns.length) {
    return <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No architecture patterns match the current filter.</div>;
  }

  return (
    <div>
      <ViewHero
        eyebrow="ARCHITECTURE PATTERNS"
        title="Curated capability stacks for common cloud decisions"
        body="Patterns are planning overlays derived from provider-authored architecture framework and foundation guidance. They organize review work; they are not compliance approval or claims of product equivalence."
        meta={[
          <StatTile key="patterns" label="PATTERNS" value={patterns.length} />,
          <StatTile key="providers" label="PROVIDERS" value={activeProviders.length} />,
        ]}
      />

      <div className="design-provider-tile-grid" style={{ gridTemplateColumns: activeProviders.map(() => "minmax(190px, 1fr)").join(" "), marginBottom: 14 }}>
        {activeProviders.map(provKey => {
          const guidance = FRAMEWORKS[provKey];
          const pm = PROVIDER_META[provKey];
          return (
            <div key={provKey} className="design-provider-tile" style={{ borderColor: pm.border, background: pm.bg }}>
              <div style={{ color: pm.dot, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 6 }}>{pm.label}</div>
              <a href={guidance.frameworkUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "var(--link)", fontSize: 9, fontWeight: 700, textDecoration: "none", lineHeight: 1.35, marginBottom: 4 }}>
                {guidance.framework}
              </a>
              <a href={guidance.foundationUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", color: "var(--link)", fontSize: 9, fontWeight: 700, textDecoration: "none", lineHeight: 1.35 }}>
                {guidance.foundation}
              </a>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {patterns.map(pattern => {
          const isExpanded = expandedPatternId === pattern.id;
          const linkedCaps = pattern.capabilities.map(name => CAPABILITY_MAP[name]).filter(Boolean);
          const providerIssueCounts = Object.fromEntries(activeProviders.map(providerKey => [
            providerKey,
            linkedCaps.filter(cap => {
              const provider = cap.providers[providerKey];
              return provider && (provider.govAvailability !== "Full" || (provider.parityLag && provider.parityLag !== "None"));
            }).length,
          ]));

          return (
            <section key={pattern.id} className="design-secondary-card">
              <button
                className="hb"
                type="button"
                onClick={() => setExpandedPatternId(isExpanded ? null : pattern.id)}
                aria-expanded={isExpanded}
                style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", color: "var(--text)", fontFamily: "inherit", padding: 0 }}
              >
                <div className="design-secondary-card-head">
                  <div>
                    <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 900, lineHeight: 1.25 }}>{pattern.name}</div>
                    <div style={{ color: "var(--muted)", fontSize: 10, lineHeight: 1.55, marginTop: 6, maxWidth: 880 }}>{pattern.summary}</div>
                    <div style={{ color: "var(--muted)", fontSize: 9, lineHeight: 1.5, marginTop: 7 }}>
                      <strong style={{ color: "var(--link)" }}>Fit: </strong>{pattern.whenToUse}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                    <span style={{ color: "var(--link)", fontSize: 9, fontWeight: 900, letterSpacing: "0.08em" }}>{isExpanded ? "COLLAPSE" : "EXPAND"}</span>
                    <VerifiedStamp date={pattern.lastVerified} />
                  </div>
                </div>
              </button>

              <div className="design-provider-tile-grid" style={{ gridTemplateColumns: activeProviders.map(() => "minmax(140px, 1fr)").join(" "), marginTop: 10 }}>
                {activeProviders.map(providerKey => {
                  const pm = PROVIDER_META[providerKey];
                  return (
                    <div key={providerKey} className="design-provider-tile" style={{ borderColor: pm.border, background: pm.bg }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ color: pm.dot, fontSize: 10, fontWeight: 900 }}>{pm.label}</span>
                        <span style={{ color: "var(--text)", fontSize: 12, fontWeight: 900 }}>{linkedCaps.length - providerIssueCounts[providerKey]}/{linkedCaps.length}</span>
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 9, lineHeight: 1.4, marginTop: 5 }}>capabilities without gov/parity review flags</div>
                    </div>
                  );
                })}
              </div>

              {isExpanded && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 900, letterSpacing: "0.1em", marginBottom: 8 }}>CAPABILITY STACK</div>
                  <div style={{ display: "grid", gap: 9 }}>
                    {linkedCaps.map(cap => (
                      <div key={cap.capability} style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel-alt)", padding: 10 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 9, flexWrap: "wrap" }}>
                          <div>
                            <CategoryLabel category={cap.category} size={12} uppercase style={{ color: "var(--category-text)", fontSize: 8, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 4 }} />
                            <div style={{ color: "var(--text)", fontSize: 11, fontWeight: 900 }}>{cap.capability}</div>
                          </div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {cap.tags.slice(0, 3).map(tag => <TagBadge key={tag} tagKey={tag} />)}
                          </div>
                        </div>
                        <div className="design-provider-tile-grid" style={{ gridTemplateColumns: activeProviders.map(() => "minmax(150px, 1fr)").join(" ") }}>
                          {activeProviders.map(providerKey => (
                            <ProviderServiceTile key={providerKey} providerKey={providerKey} provider={cap.providers[providerKey]} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="design-two-col" style={{ marginTop: 14 }}>
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 900, marginBottom: 6 }}>REVIEW QUESTIONS</div>
                      {pattern.reviewPrompts.map(prompt => (
                        <div key={prompt} style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.5, marginBottom: 6, paddingLeft: 10, borderLeft: "2px solid var(--border)" }}>{prompt}</div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 900, marginBottom: 6 }}>VERIFICATION BOUNDARY</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.65 }}>{pattern.verificationNote}</div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}


// -- CLOUD HISTORY VIEW -------------------------------------------------------
function ControlLensViewDesign({ lens, families, frameworks }) {
  const groupedFrameworks = Object.entries(COMPLIANCE_KIND_LABELS)
    .map(([kind, label]) => ({
      kind,
      label,
      items: frameworks.filter(framework => framework.kind === kind),
    }))
    .filter(group => group.items.length);

  return (
    <div>
      <ViewHero
        eyebrow="COMPLIANCE & CONTROLS"
        title={`${lens.name} ${lens.release} planning lens`}
        body={lens.scopeNote}
        meta={[
          <StatTile key="frameworks" label="FRAMEWORKS" value={frameworks.length} />,
          <StatTile key="families" label="NIST FAMILIES" value={families.length} />,
          <VerifiedStamp key="verified" date={lens.lastVerified} />,
        ]}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <a href={lens.catalogUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">Official catalog</a>
        <a href={lens.baselineUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">Control baselines</a>
        <a href={lens.oscalUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">OSCAL source</a>
      </div>

      <section style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 900, letterSpacing: "0.1em", marginBottom: 8 }}>FRAMEWORKS AND PROGRAMS</div>
        {!frameworks.length && (
          <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No compliance frameworks match the current search.</div>
        )}
        <div style={{ display: "grid", gap: 12 }}>
          {groupedFrameworks.map(group => (
            <div key={group.kind}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 10px", borderTop: "2px solid var(--link)", borderBottom: "1px solid var(--border)", background: "var(--panel-alt)", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "var(--text)", fontWeight: 900, letterSpacing: "0.08em" }}>{group.label.toUpperCase()}</div>
                <div style={{ fontSize: 8, color: "var(--muted)", fontWeight: 800 }}>{group.items.length} item(s)</div>
              </div>
              <div className="design-framework-grid">
                {group.items.map(framework => (
                  <article key={framework.id} className="design-secondary-card">
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 9 }}>
                      <div>
                        <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 900, lineHeight: 1.3 }}>{framework.name}</div>
                        <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4 }}>{framework.issuer}</div>
                      </div>
                      <ComplianceStatusBadge status={framework.status} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.55, marginBottom: 9 }}>{framework.scope}</div>
                    <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.5, marginBottom: 9 }}>
                      <strong style={{ color: "var(--text)" }}>NIST alignment: </strong>
                      {Array.isArray(framework.nistAlignment) ? framework.nistAlignment.join("; ") : framework.nistAlignment}
                    </div>
                    {framework.historicalNote && (
                      <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.5, marginBottom: 9 }}>{framework.historicalNote}</div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <a href={framework.url} target="_blank" rel="noopener noreferrer" className="design-source-link">Official source</a>
                      <VerifiedStamp date={framework.lastVerified} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 900, letterSpacing: "0.1em", marginBottom: 8 }}>NIST SP 800-53 FAMILY LENS</div>
        {!families.length && (
          <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No control families match the current filter.</div>
        )}
        <div style={{ display: "grid", gap: 10 }}>
          {families.map(family => (
            <article key={family.id} className="design-secondary-card">
              <div className="design-secondary-card-head">
                <div>
                  <div style={{ fontSize: 9, color: "var(--link)", fontWeight: 900, letterSpacing: "0.1em", marginBottom: 5 }}>FAMILY {family.id}</div>
                  <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 900, marginBottom: 6 }}>{family.name}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.55 }}>{family.applicability}</div>
                </div>
                <StatTile label="TOUCHPOINTS" value={family.capabilities.length} />
              </div>
              <div className="design-two-col">
                <div>
                  <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 900, marginBottom: 6 }}>IMPLEMENTATION TOUCHPOINTS</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {family.capabilities.map(capabilityName => (
                      <span key={capabilityName} style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel-alt)", color: "var(--text)", fontSize: 9 }}>
                        {capabilityName}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 900, marginBottom: 6 }}>ARCHITECTURE REVIEW QUESTIONS</div>
                  {family.reviewPrompts.map(prompt => (
                    <div key={prompt} style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.5, marginBottom: 6, paddingLeft: 10, borderLeft: "2px solid var(--border)" }}>{prompt}</div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}


// -- STATE AI TRANSPARENCY VIEW --------------------------------------------

function HistoryViewDesign({ items, meta, activeProviders }) {
  const years = Array.from(new Set(items.map(item => item.year))).sort((a, b) => a - b);
  const grouped = activeProviders
    .map(provider => ({
      provider,
      items: items
        .filter(item => item.provider === provider)
        .sort((a, b) => a.year - b.year || a.date.localeCompare(b.date)),
    }))
    .filter(group => group.items.length);

  return (
    <div>
      <ViewHero
        eyebrow="PROVIDER HISTORY"
        title="Cloud journey milestones by provider"
        body={meta.scopeNote}
        meta={[
          <StatTile key="milestones" label="MILESTONES" value={items.length} />,
          <StatTile key="years" label="YEARS" value={years.length} />,
          <StatTile key="providers" label="PROVIDERS" value={grouped.length} />,
          <VerifiedStamp key="verified" date={meta.lastVerified} />,
        ]}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {Object.entries(HISTORY_PHASE_STYLES).map(([phase, style]) => (
          <span key={phase} style={{ fontSize: 8, padding: "4px 8px", borderRadius: 4, border: `1px solid ${style.border}`, background: style.bg, color: style.fg, fontWeight: 800, letterSpacing: "0.06em" }}>
            {phase.toUpperCase()}
          </span>
        ))}
      </div>

      {!items.length && (
        <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No history milestones match the current filter.</div>
      )}

      <div className="design-framework-grid">
        {grouped.map(group => {
          const pm = PROVIDER_META[group.provider];
          return (
            <article key={group.provider} className="design-secondary-card" style={{ borderColor: pm.border }}>
              <div className="design-secondary-card-head">
                <div>
                  <div style={{ color: pm.dot, fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 5 }}>{pm.label}</div>
                  <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 900 }}>{pm.long}</div>
                </div>
                <StatTile label="EVENTS" value={group.items.length} tone={pm.dot} />
              </div>

              <div style={{ display: "grid", gap: 9 }}>
                {group.items.map(item => {
                  const phaseStyle = HISTORY_PHASE_STYLES[item.phase] || HISTORY_PHASE_STYLES["Commercial cloud"];
                  return (
                    <div key={item.id} style={{ padding: "10px 11px", border: `1px solid ${phaseStyle.border}`, borderLeft: `3px solid ${pm.dot}`, borderRadius: 6, background: phaseStyle.bg }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 5 }}>
                        <span style={{ fontSize: 8, color: phaseStyle.fg, fontWeight: 900, letterSpacing: "0.06em" }}>{item.phase.toUpperCase()}</span>
                        <span style={{ fontSize: 8, color: "var(--muted)", fontWeight: 800, whiteSpace: "nowrap" }}>{item.dateLabel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.35, fontWeight: 900 }}>{item.title}</div>
                      <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.55, marginTop: 5 }}>{item.summary}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", marginTop: 7 }}>
                        {item.scope.map(scope => (
                          <span key={scope} style={{ fontSize: 7, padding: "2px 5px", borderRadius: 3, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--muted)", fontWeight: 800 }}>{scope}</span>
                        ))}
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="design-source-link" style={{ marginLeft: 2 }}>
                          {item.sourceLabel}
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function TransparencyViewDesign({ items, meta }) {
  const federalContext = meta.federalContext || {};
  const counts = TRANSPARENCY_STATUS_ORDER
    .filter(status => status !== "All")
    .map(status => ({ status, count: items.filter(item => item.status === status).length }))
    .filter(item => item.count);

  return (
    <div>
      <ViewHero
        eyebrow="STATE AI TRANSPARENCY"
        title="Point-in-time public AI governance record"
        body={meta.scopeNote}
        meta={[
          <StatTile key="rows" label="ROWS" value={items.length} tone="#b45309" />,
          <StatTile key="statuses" label="STATUSES" value={counts.length} />,
          <VerifiedStamp key="verified" date={meta.last_verified} />,
        ]}
      />

      <section className="design-secondary-card" style={{ borderColor: "#b4530955", marginBottom: 14 }}>
        <div style={{ color: "#b45309", fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", marginBottom: 6 }}>FEDERAL CONTEXT</div>
        <div style={{ color: "var(--text)", fontSize: 10, lineHeight: 1.6 }}>
          Federal-state AI policy is volatile as of {meta.last_verified}. Context: {federalContext.citation} ({federalContext.title}).
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 9 }}>
          {federalContext.url && <a href={federalContext.url} target="_blank" rel="noopener noreferrer" className="design-source-link">Federal Register source</a>}
          <VerifiedStamp date={federalContext.lastVerified || meta.last_verified} />
        </div>
      </section>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {counts.map(({ status, count }) => (
          <span key={status} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 7px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--panel)" }}>
            <TransparencyStatusBadge status={status} />
            <span style={{ fontSize: 8, color: "var(--muted)", fontWeight: 800 }}>{count}</span>
          </span>
        ))}
      </div>

      {!items.length && (
        <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No state transparency rows match the current filters.</div>
      )}

      <div className="design-framework-grid">
        {items.map(item => (
          <article key={`${item.state}-${item.title}`} className="design-secondary-card">
            <div className="design-secondary-card-head">
              <div>
                <div style={{ fontSize: 9, color: "var(--link)", fontWeight: 900, letterSpacing: "0.1em", marginBottom: 5 }}>{item.state}</div>
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 900, lineHeight: 1.3 }}>{item.stateName}</div>
              </div>
              <TransparencyStatusBadge status={item.status} />
            </div>
            <div style={{ fontSize: 9, color: "var(--muted)", fontWeight: 900, letterSpacing: "0.08em", marginBottom: 5 }}>{item.instrument}</div>
            <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 900, lineHeight: 1.45 }}>{item.title}</div>
            {item.citation && <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 5, lineHeight: 1.45 }}>{item.citation}</div>}
            <div style={{ fontSize: 9, color: "var(--text)", lineHeight: 1.6, marginTop: 8 }}>{item.summary}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="design-source-link">Official source</a>}
              <VerifiedStamp date={item.lastVerified} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// -- UPCOMING BANNER ---------------------------------------------------------
function UpcomingBanner({ items }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 14, borderRadius: 6, border: "1px solid #b45309", background: "var(--panel)", overflow: "hidden" }}>
      <div onClick={() => setOpen(v => !v)} style={{ padding: "8px 14px", background: "var(--panel-alt)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "#f59e0b" }}>▶ ANNOUNCED / PREVIEW / UPCOMING — {items.length} item(s)</span>
        <span style={{ fontSize: 9, color: "#78350f" }}>{open ? "COLLAPSE ▲" : "EXPAND ▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "10px 14px", background: "var(--panel)" }}>
          {items.map(item => (
            <div key={item.id} style={{ display: "flex", gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "#78350f", color: "#fbbf24", fontWeight: 700, flexShrink: 0, height: "fit-content", marginTop: 1 }}>
                {item.status?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 10, color: PROVIDER_META[item.provider?.toLowerCase()]?.dot || "var(--text)", fontWeight: 600 }}>
                  {item.provider} · {item.category}
                  {item.expected_ga && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · Expected: {item.expected_ga}</span>}
                </div>
                <div style={{ fontSize: 10, color: "var(--text)", marginTop: 2 }}>{item.title}</div>
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>{item.detail}</div>
                {item.source && <a href={item.source} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", marginTop: 3, display: "block" }}>↗ Official source</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [mode, setMode] = useState(getInitialMode);
  const [activeProviders, setActiveProviders] = useState(getInitialProviders);
  const [selectedCategory, setSelectedCategory] = useState(getInitialCategory);
  const [searchQuery, setSearchQuery] = useState(getInitialSearchQuery);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedTier, setSelectedTier] = useState(getInitialTier);
  const [selectedTransparencyStatus, setSelectedTransparencyStatus] = useState(getInitialTransparencyStatus);
  const themeVars = THEME_TOKENS[theme];

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme switching should still work when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    syncFiltersToUrl({ mode, searchQuery, activeProviders, selectedCategory, selectedTier, selectedTransparencyStatus });
  }, [activeProviders, mode, searchQuery, selectedCategory, selectedTier, selectedTransparencyStatus]);

  const toggleProvider = p =>
    setActiveProviders(prev => {
      const next = prev.includes(p)
        ? (prev.length > 1 ? prev.filter(x => x !== p) : prev)
        : [...prev, p];
      return PROVIDERS.filter(provider => next.includes(provider));
    });

  const filteredCaps = useMemo(() => {
    let caps = CAPABILITIES;
    if (selectedCategory) caps = caps.filter(c => c.category === selectedCategory);
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      caps = caps.filter(c =>
        c.capability.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q)) ||
        c.architectureNotes?.toLowerCase().includes(q) ||
        c.operationalConsiderations?.toLowerCase().includes(q) ||
        Object.values(c.providers).some(p =>
          p.service?.toLowerCase().includes(q) ||
          p.formerNames?.some(name => name.toLowerCase().includes(q))
        )
      );
    }
    return caps;
  }, [selectedCategory, searchQuery]);

  const filteredDesignRows = useMemo(
    () => filteredCaps.map(cap => DESIGN_ROW_MAP[cap.capability]).filter(Boolean),
    [filteredCaps]
  );

  const filteredPatterns = useMemo(() => {
    let patterns = PATTERNS;
    if (selectedCategory) {
      patterns = patterns.filter(pattern =>
        pattern.capabilities.some(name => CAPABILITY_MAP[name]?.category === selectedCategory)
      );
    }
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      patterns = patterns.filter(pattern => {
        const linkedCaps = pattern.capabilities.map(name => CAPABILITY_MAP[name]).filter(Boolean);
        return (
          pattern.name.toLowerCase().includes(q) ||
          pattern.summary.toLowerCase().includes(q) ||
          pattern.whenToUse.toLowerCase().includes(q) ||
          pattern.reviewPrompts.some(prompt => prompt.toLowerCase().includes(q)) ||
          linkedCaps.some(cap =>
            cap.capability.toLowerCase().includes(q) ||
            Object.values(cap.providers).some(provider =>
              provider.service.toLowerCase().includes(q) ||
              provider.formerNames?.some(name => name.toLowerCase().includes(q))
            )
          )
        );
      });
    }
    return patterns;
  }, [selectedCategory, searchQuery]);

  const filteredControlFamilies = useMemo(() => {
    let families = CONTROL_LENS.families;
    if (selectedCategory) {
      families = families.filter(family =>
        family.capabilities.some(name => CAPABILITY_MAP[name]?.category === selectedCategory)
      );
    }
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      families = families.filter(family => {
        const linkedCaps = family.capabilities.map(name => CAPABILITY_MAP[name]).filter(Boolean);
        return (
          family.id.toLowerCase().includes(q) ||
          family.name.toLowerCase().includes(q) ||
          family.applicability.toLowerCase().includes(q) ||
          family.reviewPrompts.some(prompt => prompt.toLowerCase().includes(q)) ||
          linkedCaps.some(cap =>
            cap.capability.toLowerCase().includes(q) ||
            Object.values(cap.providers).some(provider =>
              provider.service.toLowerCase().includes(q) ||
              provider.formerNames?.some(name => name.toLowerCase().includes(q))
            )
          )
        );
      });
    }
    return families;
  }, [selectedCategory, searchQuery]);

  const filteredComplianceFrameworks = useMemo(() => {
    let frameworks = COMPLIANCE_FRAMEWORKS;
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      frameworks = frameworks.filter(framework =>
        framework.id.toLowerCase().includes(q) ||
        framework.name.toLowerCase().includes(q) ||
        framework.issuer.toLowerCase().includes(q) ||
        framework.kind.toLowerCase().includes(q) ||
        framework.status.toLowerCase().includes(q) ||
        framework.scope.toLowerCase().includes(q) ||
        String(framework.nistAlignment || "").toLowerCase().includes(q) ||
        framework.historicalNote?.toLowerCase().includes(q)
      );
    }
    return frameworks;
  }, [searchQuery]);

  const filteredHistory = useMemo(() => {
    let items = HISTORY.filter(item => activeProviders.includes(item.provider));
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.phase.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        item.scope.some(scope => scope.toLowerCase().includes(q)) ||
        item.sourceLabel.toLowerCase().includes(q)
      );
    }
    return items;
  }, [activeProviders, searchQuery]);

  const filteredTransparency = useMemo(() => {
    let items = TRANSPARENCY;
    if (selectedTransparencyStatus !== "All") {
      items = items.filter(item => item.status === selectedTransparencyStatus);
    }
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.state.toLowerCase().includes(q) ||
        item.stateName.toLowerCase().includes(q) ||
        item.instrument.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.citation.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
      );
    }
    return items;
  }, [searchQuery, selectedTransparencyStatus]);

  const filteredAiCaps = useMemo(
    () => filteredCaps.filter(c => c.tags.some(t => ["AI_NATIVE","AI_CAPABLE"].includes(t))),
    [filteredCaps]
  );

  const exportData = useMemo(() => {
    if (mode === "patterns") return patternExport(filteredPatterns, activeProviders, CAPABILITY_MAP, FRAMEWORKS);
    if (mode === "controls") return controlExport(CONTROL_LENS, filteredControlFamilies, filteredComplianceFrameworks);
    if (mode === "history") return historyExport(filteredHistory, HISTORY_META);
    if (mode === "transparency") return transparencyExport(filteredTransparency);
    if (mode === "diff") return matrixExport("diff", "Service Equivalency", filteredCaps, activeProviders, selectedTier);
    if (mode === "gov") return matrixExport("gov", "Government Availability and Parity", filteredCaps, activeProviders, selectedTier);
    if (mode === "ai") return matrixExport("ai", "AI Focus", filteredAiCaps, activeProviders, selectedTier);
    return matrixExport("matrix", "Capability Matrix", filteredCaps, activeProviders, selectedTier);
  }, [activeProviders, filteredAiCaps, filteredCaps, filteredComplianceFrameworks, filteredControlFamilies, filteredHistory, filteredPatterns, filteredTransparency, mode, selectedTier]);

  const govAlertCount = CAPABILITIES.filter(c =>
    Object.values(c.providers).some(p => p.govAvailability !== "Full" || (p.parityLag && p.parityLag !== "None"))
  ).length;

  const resultCount =
    mode === "patterns" ? filteredPatterns.length :
    mode === "controls" ? filteredControlFamilies.length + filteredComplianceFrameworks.length :
    mode === "history" ? filteredHistory.length :
    mode === "transparency" ? filteredTransparency.length :
    mode === "ai" ? filteredAiCaps.length :
    filteredCaps.length;

  const modes = [
    { id: "matrix", label: "MATRIX", desc: "All capabilities by tier" },
    { id: "patterns", label: "PATTERNS", desc: "Architecture planning overlays" },
    { id: "controls", label: "COMPLIANCE", desc: "Framework references plus NIST 800-53 planning lens" },
    { id: "history", label: "HISTORY", desc: "Provider cloud journey milestones" },
    { id: "transparency", label: "TRANSPARENCY", desc: "State AI governance public record" },
    { id: "diff",   label: "EQUIVALENCY", desc: "Side-by-side service mapping" },
    { id: "gov",    label: `GOV / PARITY`, desc: "Government availability focus" },
    { id: "ai",     label: "AI FOCUS", desc: "AI_NATIVE and AI_CAPABLE only" },
  ];
  const providerGridModes = ["matrix", "diff", "gov", "ai", "patterns"];
  const contentMinWidthPx = providerGridModes.includes(mode) && activeProviders.length > 3 ? 1040 : 780;

  return (
    <div style={{ ...themeVars, colorScheme: theme, fontFamily: "'IBM Plex Mono','Courier New',monospace", background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; background: var(--panel-alt); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .hb { transition: all 0.12s; cursor: pointer; }
        .hb:hover { opacity: 0.78; }
        a:hover { opacity: 0.8; }
        input::placeholder { color: var(--muted); opacity: 0.72; }
        input:focus { outline: none; border-color: var(--link) !important; }
        .filter-groups { display: grid; gap: 14px; }
        .filter-groups.with-context { grid-template-columns: minmax(420px, 1fr) minmax(280px, 370px); }
        .filter-context { padding-left: 16px; border-left: 1px solid var(--border); }
        .design-matrix-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
          gap: 14px;
          align-items: start;
        }
        .design-coverage-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 8px;
        }
        .design-coverage-card {
          padding: 10px 11px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel-alt);
        }
        .design-matrix-grid {
          display: grid;
          gap: 7px;
          align-items: stretch;
        }
        .design-grid-head {
          padding: 8px 11px;
          border: 1px solid var(--border);
          border-radius: 5px;
          background: var(--panel-alt);
          color: var(--muted);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .design-capability-cell,
        .design-provider-cell {
          display: block;
          width: 100%;
          min-height: 104px;
          text-align: left;
          padding: 10px 11px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-family: inherit;
        }
        .design-detail-panel {
          position: sticky;
          top: 98px;
          max-height: calc(100vh - 118px);
          overflow: auto;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel);
        }
        .design-view-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin: 10px 0 14px;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel);
        }
        .design-secondary-card {
          padding: 13px 14px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel);
        }
        .design-secondary-card-head {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
          margin-bottom: 12px;
        }
        .design-provider-tile-grid {
          display: grid;
          gap: 8px;
        }
        .design-provider-tile {
          padding: 9px 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel-alt);
          min-width: 0;
        }
        .design-source-link {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          max-width: 100%;
          padding: 5px 8px;
          border: 1px solid var(--border);
          border-radius: 4px;
          color: var(--link);
          background: var(--panel-alt);
          font-size: 9px;
          font-weight: 800;
          line-height: 1.35;
          text-decoration: none;
          overflow-wrap: anywhere;
          white-space: normal;
        }
        .design-two-col {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
        }
        .design-framework-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 10px;
        }
        @media (max-width: 980px) {
          .design-matrix-shell { grid-template-columns: 1fr; }
          .design-detail-panel { position: static; max-height: none; }
          .design-secondary-card-head,
          .design-two-col { grid-template-columns: 1fr; }
          .design-provider-tile-grid { grid-template-columns: 1fr !important; }
          .filter-groups.with-context { grid-template-columns: 1fr; }
          .filter-context { padding-left: 0; padding-top: 10px; border-left: none; border-top: 1px solid var(--border); }
        }
        .print-export { display: none; }
        @media print {
          @page { size: landscape; margin: 0.35in; }
          body { background: #ffffff !important; }
          .app-screen { display: none !important; }
          .print-export {
            display: block !important;
            color: #111827;
            background: #ffffff;
            font-family: Arial, sans-serif;
          }
          .print-export h1 { margin: 0 0 6px; font-size: 16px; }
          .print-export p { margin: 0 0 12px; color: #374151; font-size: 9px; }
          .print-export table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 7px;
          }
          .print-export thead { display: table-header-group; }
          .print-export th,
          .print-export td {
            border: 1px solid #cbd5e1;
            padding: 3px 4px;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
          }
          .print-export th { background: #e2e8f0; font-weight: 700; }
        }
      `}</style>

      <div className="app-screen">

      {/* ── HEADER ── */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px 0", background: "var(--header-bg)" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--link)", marginBottom: 3, fontWeight: 700 }}>
              ENTERPRISE CLOUD CAPABILITY INTELLIGENCE
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              {PROVIDERS.map(provider => PROVIDER_META[provider].label).join(" · ")}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              {CAPABILITIES.length} capabilities · {PATTERNS.length} patterns · {COMPLIANCE_FRAMEWORKS.length} compliance frameworks · {CONTROL_LENS.families.length} NIST families · {HISTORY.length} history milestones · {TRANSPARENCY.length} state AI rows · {CATEGORIES.length} categories · fact-first · official sources only
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f87171" }}>{govAlertCount}</div>
              <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.06em" }}>GOV REVIEW</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#c084fc" }}>{CAPABILITIES.filter(c => c.tags.includes("AI_NATIVE")).length}</div>
              <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.06em" }}>AI_NATIVE</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#22d3ee" }}>{CAPABILITIES.filter(c => c.tags.includes("COMPLIANCE_RELEVANT")).length}</div>
              <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.06em" }}>COMPLIANCE</div>
            </div>
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
          {modes.map(m => (
            <button key={m.id} className="hb" onClick={() => setMode(m.id)} style={{
              padding: "8px 18px", border: "none", borderBottom: mode === m.id ? "2px solid var(--link)" : "2px solid transparent",
              background: "transparent", color: mode === m.id ? "var(--link)" : "var(--muted)",
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", fontFamily: "inherit",
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, padding: "10px 24px 12px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px", minWidth: 240, maxWidth: 440 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search capability, pattern, state, service, tag..."
              style={{
                width: "100%", padding: "7px 12px", borderRadius: 4,
                border: "1px solid var(--border)", background: "var(--panel-alt)",
                color: "var(--text)", fontSize: 10, fontFamily: "inherit",
              }}
            />
          </div>

          {mode === "matrix" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700 }}>TIER</span>
              {META.tiers.map(t => (
                <button key={t} className="hb" onClick={() => setSelectedTier(selectedTier === t ? null : t)} style={{
                  padding: "3px 9px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                  border: `1px solid ${selectedTier === t ? "var(--selected-border)" : "var(--border)"}`,
                  background: selectedTier === t ? "var(--selected-bg)" : "transparent",
                  color: selectedTier === t ? "var(--selected-text)" : "var(--muted)",
                }}>{t}</button>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700 }}>PROVIDERS</span>
            {PROVIDERS.map(p => (
              <button key={p} className="hb" onClick={() => toggleProvider(p)} style={{
                padding: "3px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: "0.07em",
                border: `1px solid ${activeProviders.includes(p) ? PROVIDER_META[p].dot : "var(--border)"}`,
                background: activeProviders.includes(p) ? `${PROVIDER_META[p].dot}22` : "transparent",
                color: activeProviders.includes(p) ? PROVIDER_META[p].dot : "var(--muted)",
              }}>{PROVIDER_META[p].label}</button>
            ))}
          </div>

          <button
            className="hb"
            onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")}
            style={{
              marginLeft: "auto", padding: "6px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700,
              border: "1px solid var(--border)", background: "var(--panel-alt)",
              color: "var(--text)", fontFamily: "inherit", whiteSpace: "nowrap",
            }}
          >
            Theme: {theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>

        <div className={`filter-groups ${mode === "controls" || mode === "transparency" ? "with-context" : ""}`}>
          <div>
            {mode === "transparency" ? (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700 }}>STATE AI STATUS</span>
                  <span style={{ fontSize: 9, color: "var(--text)", fontWeight: 600 }}>
                    Active: {selectedTransparencyStatus}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {TRANSPARENCY_STATUS_ORDER.map(status => {
                    const count = status === "All" ? TRANSPARENCY.length : TRANSPARENCY.filter(item => item.status === status).length;
                    return (
                      <button key={status} className="hb" onClick={() => setSelectedTransparencyStatus(status)} style={{
                        padding: "3px 10px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                        border: `1px solid ${selectedTransparencyStatus === status ? "var(--link)" : "var(--border)"}`,
                        background: selectedTransparencyStatus === status ? "var(--selected-bg)" : "transparent",
                        color: selectedTransparencyStatus === status ? "var(--selected-text)" : "var(--muted)",
                      }}>{status} ({count})</button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700 }}>CAPABILITY CATEGORY</span>
                  <span style={{ fontSize: 9, color: "var(--text)", fontWeight: 600 }}>
                    Active: {selectedCategory || "All categories"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <button className="hb" onClick={() => setSelectedCategory(null)} style={{
                    padding: "3px 10px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                    border: `1px solid ${!selectedCategory ? "var(--link)" : "var(--border)"}`,
                    background: !selectedCategory ? "var(--selected-bg)" : "transparent",
                    color: !selectedCategory ? "var(--selected-text)" : "var(--muted)",
                  }}>ALL ({CAPABILITIES.length})</button>
                  {CATEGORIES.map(cat => {
                    const count = CAPABILITIES.filter(c => c.category === cat).length;
                    return (
                      <button key={cat} className="hb" onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)} style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                        border: `1px solid ${selectedCategory === cat ? "var(--link)" : "var(--border)"}`,
                        background: selectedCategory === cat ? "var(--selected-bg)" : "transparent",
                        color: selectedCategory === cat ? "var(--selected-text)" : "var(--muted)",
                      }}>
                        <CategoryLabel category={cat} size={12} />
                        <span>({count})</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {mode === "controls" && (
            <div className="filter-context">
              <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 7 }}>VIEW CONTEXT</div>
              <div style={{ fontSize: 10, color: "var(--text)", fontWeight: 700, marginBottom: 4 }}>COMPLIANCE LENS</div>
              <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.55 }}>Search filters frameworks and control families. Category filters apply to linked NIST capabilities only. Tier guidance is not applied in this view.</div>
            </div>
          )}

          {mode === "transparency" && (
            <div className="filter-context">
              <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 7 }}>VIEW CONTEXT</div>
              <div style={{ fontSize: 10, color: "var(--text)", fontWeight: 700, marginBottom: 4 }}>STATE AI TRANSPARENCY</div>
              <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.55 }}>Rows are official-source public records. Unknown means the state has not been populated in this launch scaffold.</div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "14px 24px 40px", overflowX: "auto" }}>
        <div style={{ minWidth: `min(${contentMinWidthPx}px, 100%)` }}>
          <UpcomingBanner items={UPCOMING} />

          {/* Search result count */}
          {searchQuery.trim().length >= 2 && (
            <div style={{ marginBottom: 10, fontSize: 9, color: "var(--muted)" }}>
              {resultCount} result(s) for "{searchQuery}"
            </div>
          )}

          <ExportToolbar exportData={exportData} />

          {mode === "matrix" && (
            <DesignMatrixView
              rows={filteredDesignRows}
              activeProviders={activeProviders}
              selectedId={expandedId}
              setSelectedId={setExpandedId}
              tier={selectedTier}
            />
          )}

          {mode === "diff" && <DiffViewDesign caps={filteredCaps} activeProviders={activeProviders} />}
          {mode === "gov"  && <GovViewDesign  caps={filteredCaps} activeProviders={activeProviders} />}
          {mode === "ai"   && <AIViewDesign caps={filteredAiCaps} activeProviders={activeProviders} />}
          {mode === "patterns" && <PatternViewDesign patterns={filteredPatterns} activeProviders={activeProviders} />}
          {mode === "controls" && <ControlLensViewDesign lens={CONTROL_LENS} families={filteredControlFamilies} frameworks={filteredComplianceFrameworks} />}
          {mode === "history" && <HistoryViewDesign items={filteredHistory} meta={HISTORY_META} activeProviders={activeProviders} />}
          {mode === "transparency" && <TransparencyViewDesign items={filteredTransparency} meta={TRANSPARENCY_META} />}
        </div>

        {/* Tag legend */}
        <div style={{ marginTop: 24, padding: "12px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--panel)" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", marginBottom: 8, fontWeight: 700 }}>TAG LEGEND</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(TAG_DEFS).map(([k, def]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <TagBadge tagKey={k} />
                <span style={{ fontSize: 8, color: "var(--muted)" }}>{def.description}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "grid", gap: 8 }}>
            <GovAvailabilityGlossaryLegend />
            <ParityLagGlossaryLegend />
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700 }}>VERIFICATION</span>
            <VerificationPill
              state="verified"
              label="VERIFIED"
              icon="✓"
              title={`Official-source review is inside the ${VERIFICATION_REVIEW_WINDOW_DAYS}-day review window.`}
            />
            <span style={{ fontSize: 8, color: "var(--muted)" }}>inside review window</span>
            <VerificationPill
              state="review"
              label="REVIEW NEEDED"
              icon="!"
              title="The item is missing a valid review date or is outside the review window."
            />
            <span style={{ fontSize: 8, color: "var(--muted)" }}>missing, invalid, or stale review date</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 8, color: "var(--muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>Data: official provider documentation only</span>
            <span>Last verified: {META.last_verified}</span>
            <span>v{META.version}</span>
            <a href={`${import.meta.env.BASE_URL}Cloud_Intelligence_Matrix.xlsx`} style={{ color: "var(--link)" }}>↗ Download XLSX</a>
            <a href="https://github.com/MW8-ai/CloudIntelMatrix" target="_blank" rel="noopener noreferrer" style={{ color: "var(--link)" }}>↗ GitHub</a>
            <a href="https://github.com/MW8-ai/CloudIntelMatrix/issues/new/choose" target="_blank" rel="noopener noreferrer" style={{ color: "var(--link)" }}>↗ Report correction</a>
          </div>
        </div>
      </div>
      </div>
      <PrintableExport exportData={exportData} />
    </div>
  );
}
