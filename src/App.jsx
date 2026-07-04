import { useState, useMemo, useEffect } from "react";
import matrixData   from "../data/matrix.json";
import upcomingData from "../data/upcoming.json";
import historyData  from "../data/history.json";
import transparencyData from "../data/transparency.json";
import statusData from "../data/status.json";
import aiWatchData from "../data/ai_watch.json";
import {
  aiWatchExport,
  controlExport,
  downloadCsv,
  downloadXlsx,
  historyExport,
  matrixExport,
  patternExport,
  printExport,
  providerNewsExport,
  statusExport,
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
  CATEGORY_TO_LAYER,
  DESIGN_LAYERS,
  PROVIDER_LABELS,
  buildDesignViewModel,
  groupRowsByLayer,
} from "./viewModels.mjs";
import { LOGOS, ICONS } from "./assets/cimAssets.js";

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
const UPCOMING_META = upcomingData._meta || {};
const HISTORY = historyData.history || [];
const HISTORY_META = historyData._meta || {};
const TRANSPARENCY = transparencyData.mandates || [];
const TRANSPARENCY_META = transparencyData._meta || {};
const STATUS_SOURCES = statusData.sources || [];
const STATUS_META = statusData._meta || {};
const AI_WATCH_SOURCES = aiWatchData.sources || [];
const AI_WATCH_META = aiWatchData._meta || {};
const PROVIDERS = META.providers;
const CAPABILITY_MAP = Object.fromEntries(CAPABILITIES.map(cap => [cap.capability, cap]));
const DESIGN_MODEL = buildDesignViewModel({ matrixData, historyData, transparencyData, upcomingData });
const DESIGN_ROW_MAP = Object.fromEntries(DESIGN_MODEL.CIM_DATA.map(row => [row.cap, row]));

const THEME_STORAGE_KEY = "cloudintel-theme";
const DEFAULT_MODE = "overview";
const DEFAULT_TIER = "Enterprise";
const DEFAULT_LAYER = "All";
const DEFAULT_MATRIX_LENS = "all";
const DEFAULT_MATRIX_AI_SCOPE = "All";
const DEFAULT_MATRIX_DENSITY = "Detailed";
const DEFAULT_TRANSPARENCY_STATUS = "All";
const VALID_MODES = ["overview", "matrix", "patterns", "controls", "history", "provider-news", "status", "ai-watch", "transparency"];
const MATRIX_LENSES = [
  { id: "all", label: "Capability", note: "All capability rows" },
  { id: "diff", label: "Equivalency", note: "Side-by-side provider service mapping" },
  { id: "gov", label: "Gov / Parity", note: "Rows needing regulated availability or parity review" },
  { id: "ai", label: "AI Focus", note: "AI-native and AI-capable rows" },
];
const MATRIX_AI_FILTERS = ["All", "AI_NATIVE", "AI_CAPABLE", "STANDARD"];
const MATRIX_DENSITIES = ["Detailed", "Compact"];

const THEME_TOKENS = {
  light: {
    "--bg": "#f6f8fb",
    "--header-bg": "#ffffff",
    "--panel": "#ffffff",
    "--panel-alt": "#f9fbfd",
    "--text": "#1b1c20",
    "--muted": "#71747c",
    "--border": "#dfe5ee",
    "--link": "#0b62b9",
    "--selected-bg": "#dceeff",
    "--selected-text": "#064f9f",
    "--selected-border": "#0b62b9",
    "--category-bg": "#eef3f8",
    "--category-text": "#17456f",
    "--tier-bg": "#eef6fd",
    "--verified-bg": "#dcfce7",
    "--verified-text": "#166534",
    "--verified-border": "#86efac",
    "--review-bg": "#f1f5f9",
    "--review-text": "#475569",
    "--review-border": "#cbd5e1",
    "--warn-bg": "#fff7ed",
    "--warn-text": "#9a3412",
    "--warn-border": "#fed7aa",
    "--ink2": "#4a4d57",
    "--faint": "#8896aa",
    "--head": "#eef2f7",
    "--rowalt": "#f8fafc",
    "--border2": "#e8edf4",
    "--shadow": "rgba(22,22,20,.07)",
    "--cols": "minmax(240px, 1.15fr) repeat(4, minmax(170px, 1fr))",
  },
  dark: {
    "--bg": "#14161b",
    "--header-bg": "#1c1f26",
    "--panel": "#1c1f26",
    "--panel-alt": "#191c22",
    "--text": "#eceef2",
    "--muted": "#969ba6",
    "--border": "#2b2f38",
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
    "--warn-bg": "#3b1f0d",
    "--warn-text": "#fdba74",
    "--warn-border": "#9a3412",
    "--ink2": "#c3c7d0",
    "--faint": "#6f747f",
    "--head": "#222630",
    "--rowalt": "#191c22",
    "--border2": "#262a32",
    "--shadow": "rgba(0,0,0,.35)",
    "--cols": "minmax(240px, 1.15fr) repeat(4, minmax(170px, 1fr))",
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
  if (["diff", "gov", "ai"].includes(value)) return "matrix";
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

function getInitialLayer() {
  const value = getUrlSearchParams().get("layer");
  return DESIGN_LAYERS.some(layer => layer.label === value) ? value : DEFAULT_LAYER;
}

function getInitialMatrixLens() {
  const params = getUrlSearchParams();
  const lens = params.get("lens");
  if (MATRIX_LENSES.some(item => item.id === lens)) return lens;
  const legacyView = params.get("view");
  if (["diff", "gov", "ai"].includes(legacyView)) return legacyView;
  return DEFAULT_MATRIX_LENS;
}

function getInitialMatrixAiScope() {
  const value = getUrlSearchParams().get("ai");
  return MATRIX_AI_FILTERS.includes(value) ? value : DEFAULT_MATRIX_AI_SCOPE;
}

function getInitialMatrixDensity() {
  const value = getUrlSearchParams().get("density");
  return MATRIX_DENSITIES.includes(value) ? value : DEFAULT_MATRIX_DENSITY;
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

function syncFiltersToUrl({ mode, searchQuery, activeProviders, selectedCategory, selectedLayer, selectedMatrixLens, selectedMatrixAiScope, matrixDensity, selectedTier, selectedTransparencyStatus }) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (mode !== DEFAULT_MODE) params.set("view", mode);
  const q = searchQuery.trim();
  if (q) params.set("q", q);
  if (activeProviders.length !== PROVIDERS.length) params.set("providers", activeProviders.join(","));
  if (selectedCategory) params.set("category", selectedCategory);
  if (mode === "matrix") {
    if (selectedMatrixLens !== DEFAULT_MATRIX_LENS) params.set("lens", selectedMatrixLens);
    if (selectedLayer !== DEFAULT_LAYER) params.set("layer", selectedLayer);
    if (selectedMatrixAiScope !== DEFAULT_MATRIX_AI_SCOPE) params.set("ai", selectedMatrixAiScope);
    if (matrixDensity !== DEFAULT_MATRIX_DENSITY) params.set("density", matrixDensity);
  }
  if (selectedTier === null) params.set("tier", "all");
  else if (selectedTier !== DEFAULT_TIER) params.set("tier", selectedTier);
  if (selectedTransparencyStatus !== DEFAULT_TRANSPARENCY_STATUS) params.set("state", selectedTransparencyStatus);

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) window.history.replaceState(null, "", nextUrl);
}

const PROVIDER_META = {
  aws:   { label: "AWS",   long: "Amazon Web Services",         dot: "#FF9900", bg: "#FF990011", border: "#FF990033" },
  azure: { label: "Azure", long: "Microsoft Azure",             dot: "#0078D4", bg: "#0078D411", border: "#0078D433" },
  gcp:   { label: "GCP",   long: "Google Cloud",                dot: "#1a73e8", bg: "#1a73e811", border: "#1a73e833" },
  oci:   { label: "OCI",   long: "Oracle Cloud Infrastructure", dot: "#C74634", bg: "#C7463411", border: "#C7463444" },
};

const GOV_AVAIL_STYLES = {
  "Full":    { bg: "#e7f4ec", fg: "#13693f", border: "#bfe3cf", dot: "#1f8a5b", label: "Full" },
  "Partial": { bg: "#f8efda", fg: "#946610", border: "#ecd6a4", dot: "#c98a1a", label: "Partial" },
  "Limited": { bg: "#f8e8de", fg: "#a3471c", border: "#eccab5", dot: "#cf5f2c", label: "Limited" },
  "None":    { bg: "#f0f0ee", fg: "#6f717a", border: "#dededa", dot: "#9a9ca3", label: "None" },
  "Unknown": { bg: "#f0f0ee", fg: "#6f717a", border: "#dededa", dot: "#9a9ca3", label: "Unknown" },
};

const PARITY_STYLES = {
  "None":        { dot: "#1f8a5b", text: "no gap",          label: "LAG NONE",        bg: "#e7f4ec22", fg: "#13693f", border: "#13693f44" },
  "Minor":       { dot: "#7aa64a", text: "minor gap",       label: "LAG MINOR",       bg: "#f0f5e422", fg: "#527a1a", border: "#527a1a44" },
  "Moderate":    { dot: "#c98a1a", text: "moderate gap",    label: "LAG MODERATE",    bg: "#f8efda22", fg: "#946610", border: "#94661044" },
  "Significant": { dot: "#c0392b", text: "significant gap", label: "LAG SIGNIFICANT", bg: "#f8e8de22", fg: "#a3471c", border: "#a3471c44" },
  "Unknown":     { dot: "#b8bac0", text: "not established", label: "NOT ESTABLISHED", bg: "#f0f0ee22", fg: "#6f717a", border: "#6f717a44" },
};

function govAvailabilityDisplay(value, long = false) {
  if (!value || value === "Unknown") return long ? "Not officially documented" : "Not documented";
  return value;
}

function parityLagDisplay(value) {
  if (!value || value === "Unknown") return "not established";
  return PARITY_STYLES[value]?.text || value;
}

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
  "Commercial cloud": { bg: "#e7f0fb", fg: "#0a6ec2", border: "#b7d3f0" },
  "Personal / Free": { bg: "#e7f4ec", fg: "#1f8a5b", border: "#bfe3cf" },
  "Government state/federal": { bg: "#f8e8e8", fg: "#bb3b34", border: "#e7b9b6" },
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

const STATE_TILE_POSITIONS = {
  WA: [1, 1], MT: [1, 3], ND: [1, 4], MN: [1, 5], WI: [1, 6], MI: [1, 7], NY: [1, 10], VT: [1, 11], ME: [1, 12],
  OR: [2, 1], ID: [2, 2], WY: [2, 3], SD: [2, 4], IA: [2, 5], IL: [2, 6], IN: [2, 7], OH: [2, 8], PA: [2, 9], NJ: [2, 10], NH: [2, 11], MA: [2, 12],
  CA: [3, 1], NV: [3, 2], UT: [3, 3], NE: [3, 4], MO: [3, 5], KY: [3, 6], WV: [3, 7], VA: [3, 8], MD: [3, 9], DE: [3, 10], CT: [3, 11], RI: [3, 12],
  AZ: [4, 2], CO: [4, 3], KS: [4, 4], AR: [4, 5], TN: [4, 6], NC: [4, 8], DC: [4, 9],
  NM: [5, 3], OK: [5, 4], LA: [5, 5], MS: [5, 6], AL: [5, 7], SC: [5, 8], GA: [5, 9],
  TX: [6, 4], FL: [6, 10],
  AK: [7, 1], HI: [7, 2],
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
  const s = GOV_AVAIL_STYLES[avail] || GOV_AVAIL_STYLES["Unknown"];
  const glossary = getGovAvailabilityGlossary(avail);
  return (
    <GlossaryBadge label={govAvailabilityDisplay(avail)} description={glossary.description} styleDef={s} shape="block" />
  );
}

function ParityBadge({ parity }) {
  if (!parity || parity === "None") return null;
  const s = PARITY_STYLES[parity] || PARITY_STYLES["Minor"];
  const glossary = getParityLagGlossary(parity);
  return (
    <GlossaryBadge label={parity === "Unknown" ? "Not established" : s.label} description={glossary.description} styleDef={s} shape="block" />
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
            label={govAvailabilityDisplay(value)}
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
            label={value === "Unknown" ? "Not established" : styleDef.label || "LAG NONE"}
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
function ExportToolbar({ exportData, compact = false }) {
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
    <div className={`export-toolbar ${compact ? "compact-export-toolbar" : ""}`} style={{ marginBottom: compact ? 0 : 12, padding: compact ? "9px 10px" : "8px 10px", border: "1px solid var(--border)", borderRadius: 6, background: compact ? "var(--panel-alt)" : "var(--panel)", display: "flex", alignItems: compact ? "flex-start" : "center", justifyContent: "space-between", gap: compact ? 8 : 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: compact ? 8 : 9, color: "var(--link)", fontWeight: 700, letterSpacing: "0.1em" }}>{compact ? "EXPORT" : "EXPORT VISIBLE VIEW"}</div>
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
  return GOV_AVAIL_STYLES[value] || GOV_AVAIL_STYLES["Unknown"];
}

function truncateText(value, maxLength = 120) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trim()}...`;
}

function getProviderPreviewText(provider, tier) {
  return truncateText(
    (tier ? provider.tierNotes?.[tier] : "") ||
    provider.note ||
    provider.variant,
    128
  );
}

function getProviderQuickLinks(provider) {
  return [
    provider.doc ? { label: "Docs", href: provider.doc } : null,
    provider.govdoc ? { label: "Gov", href: provider.govdoc } : null,
    provider.price ? { label: "Price", href: provider.price } : null,
    provider.compliance ? { label: "Compliance", href: provider.compliance } : null,
  ].filter(Boolean);
}

function hasDepthValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function formatDepthValue(value) {
  if (!hasDepthValue(value)) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, entryValue]) => hasDepthValue(entryValue))
      .map(([key, entryValue]) => `${key}: ${formatDepthValue(entryValue)}`)
      .join("; ");
  }
  return String(value);
}

function formatCostModel(costModel = {}) {
  const parts = [];
  if (hasDepthValue(costModel.shape)) parts.push(`Shape: ${costModel.shape}`);
  if (typeof costModel.egressSensitive === "boolean") parts.push(`Egress sensitive: ${formatDepthValue(costModel.egressSensitive)}`);
  if (typeof costModel.commitmentDiscountAvailable === "boolean") parts.push(`Commitment discount: ${formatDepthValue(costModel.commitmentDiscountAvailable)}`);
  return parts.join("; ");
}

function formatPqcReadiness(pqcReadiness = {}) {
  const parts = [];
  if (hasDepthValue(pqcReadiness.status)) parts.push(`Status: ${pqcReadiness.status}`);
  if (hasDepthValue(pqcReadiness.fipsEndpointParity)) parts.push(`FIPS endpoint parity: ${pqcReadiness.fipsEndpointParity}`);
  if (hasDepthValue(pqcReadiness.milestoneDate)) parts.push(`Milestone: ${pqcReadiness.milestoneDate}`);
  if (hasDepthValue(pqcReadiness.kem)) parts.push(`KEM: ${pqcReadiness.kem}`);
  if (hasDepthValue(pqcReadiness.signature)) parts.push(`Signature: ${pqcReadiness.signature}`);
  if (hasDepthValue(pqcReadiness.tls)) parts.push(`TLS: ${pqcReadiness.tls}`);
  if (hasDepthValue(pqcReadiness.vpn)) parts.push(`VPN: ${pqcReadiness.vpn}`);
  if (hasDepthValue(pqcReadiness.govPqc)) parts.push(`Gov PQC: ${pqcReadiness.govPqc}`);
  if (hasDepthValue(pqcReadiness.source)) parts.push(`Source: ${pqcReadiness.source}`);
  if (hasDepthValue(pqcReadiness.sourceDate)) parts.push(`Source date: ${pqcReadiness.sourceDate}`);
  if (typeof pqcReadiness.firstParty === "boolean") parts.push(`First party: ${formatDepthValue(pqcReadiness.firstParty)}`);
  if (hasDepthValue(pqcReadiness.confidence)) parts.push(`Confidence: ${pqcReadiness.confidence}`);
  if (hasDepthValue(pqcReadiness.note)) parts.push(`Note: ${pqcReadiness.note}`);
  return parts.join("; ");
}

function formatResidencySummary(residency = []) {
  if (!Array.isArray(residency) || residency.length === 0) return "";
  return residency
    .map(item => {
      const flags = [];
      if (hasDepthValue(item.status)) flags.push(item.status);
      if (hasDepthValue(item.geography)) flags.push(item.geography);
      if (item.firstParty === false) flags.push("Partner-operated");
      return [item.offering, flags.filter(Boolean).join(" / ")].filter(Boolean).join(": ");
    })
    .join("; ");
}

function formatFedrampEnvironment(label, environment = {}) {
  const parts = [];
  if (hasDepthValue(environment.status)) parts.push(`${label}: ${environment.status}`);
  if (hasDepthValue(environment.dodIL)) parts.push(`DoD ${environment.dodIL}`);
  if (hasDepthValue(environment.boundary)) parts.push(environment.boundary);
  if (hasDepthValue(environment.date)) parts.push(`Date: ${environment.date}`);
  if (hasDepthValue(environment.confidence)) parts.push(`Confidence: ${environment.confidence}`);
  if (hasDepthValue(environment.url)) parts.push(`Source: ${environment.url}`);
  if (hasDepthValue(environment.note)) parts.push(`Note: ${environment.note}`);
  return parts.join(", ");
}

function formatFedramp(fedramp = {}, fallbackLevel = "") {
  const parts = [
    formatFedrampEnvironment("Commercial", fedramp.commercial),
    formatFedrampEnvironment("Government", fedramp.government),
  ].filter(Boolean);
  if (parts.length) return parts.join("; ");
  if (hasDepthValue(fallbackLevel)) return fallbackLevel;
  return "";
}

function getParityReasoning(provider) {
  if (hasDepthValue(provider.parityDetail)) return provider.parityDetail;
  const note = String(provider.note || "").trim();
  if (!note) return "";
  const marker = "paritylag verified";
  const index = note.toLowerCase().indexOf(marker);
  if (index >= 0) return note.slice(index).trim();
  if (provider.lag && provider.lag !== "None") return note;
  return "";
}

function ProviderDepthField({ label, value }) {
  const populated = hasDepthValue(value);
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px", minWidth: 0 }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: populated ? "var(--ink2)" : "var(--faint)", lineHeight: 1.45, overflowWrap: "anywhere" }}>
        {populated ? value : "Not populated"}
      </div>
    </div>
  );
}

function matrixEvidenceSummary(rows, activeProviders) {
  if (!rows.length) return "Evidence: no visible matrix rows";
  return activeProviders.map(providerKey => {
    const label = providerLabelForKey(providerKey);
    const documented = rows.reduce((count, row) => {
      const status = row.providers?.[label]?.gov || "Unknown";
      return ["Full", "Partial", "Limited"].includes(status) ? count + 1 : count;
    }, 0);
    return `${label} ${documented}/${rows.length} documented`;
  }).join(" | ");
}

function MatrixCoverageStrip({ rows, activeProviders, onDismiss }) {
  const statuses = ["Full", "Partial", "Limited", "None", "Unknown"];
  const evidenceStatuses = new Set(["Full", "Partial", "Limited"]);
  const [expandedProvider, setExpandedProvider] = useState(null);
  const providerSummaries = activeProviders.map(providerKey => {
    const label = providerLabelForKey(providerKey);
    const pm = PROVIDER_META[providerKey];
    const counts = Object.fromEntries(statuses.map(status => [status, 0]));
    const detailRows = rows.map(row => {
      const provider = row.providers?.[label];
      const status = provider?.gov || "Unknown";
      counts[status] = (counts[status] || 0) + 1;
      return {
        cap: row.cap,
        category: row.cat,
        status,
        parity: provider?.lag || "Unknown",
        service: provider?.svc || "Not mapped",
        variant: provider?.variant || "Region or realm not structured",
        region: provider?.region || "",
        realmClass: provider?.realmClass || "",
        lastVerified: provider?.lastVerified || row.lastVerified || "Not recorded",
        source: provider?.govdoc || provider?.doc || "",
        note: provider?.note || "",
      };
    });
    const documented = counts.Full + counts.Partial + counts.Limited;
    return {
      providerKey,
      label,
      pm,
      counts,
      detailRows,
      evidenceRows: detailRows.filter(row => evidenceStatuses.has(row.status)),
      unavailableRows: detailRows.filter(row => row.status === "None"),
      unknownRows: detailRows.filter(row => row.status === "Unknown"),
      parityUnknownRows: detailRows.filter(row => row.parity === "Unknown"),
      documented,
    };
  });
  const expandedSummary = providerSummaries.find(summary => summary.providerKey === expandedProvider);

  function toggleExpandedProvider(providerKey) {
    setExpandedProvider(current => current === providerKey ? null : providerKey);
  }

  return (
    <section className="design-coverage-detail" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "var(--link)", letterSpacing: "0.1em", fontWeight: 900, textTransform: "uppercase" }}>
            About matrix evidence
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.55, marginTop: 4, maxWidth: 820 }}>
            Counts here describe the currently visible capability rows, not provider scores, document totals, or completeness ratings. None means official documentation says the mapped service is unavailable. Not documented means public official evidence has not established a stronger claim.
          </div>
        </div>
        <button
          type="button"
          className="hb"
          onClick={onDismiss}
          style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)", color: "var(--muted)", padding: "5px 9px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 800 }}
        >
          Hide
        </button>
      </div>
      <div className="design-coverage-strip">
        {providerSummaries.map(summary => {
          const { providerKey, label, pm, counts, documented } = summary;
          const isExpanded = expandedProvider === providerKey;

          return (
            <button
              key={providerKey}
              type="button"
              className="design-coverage-card hb"
              onClick={() => toggleExpandedProvider(providerKey)}
              aria-expanded={isExpanded}
              aria-controls={`evidence-detail-${providerKey}`}
              title={`Show ${label} evidence posture rows`}
              style={{ borderColor: isExpanded ? pm.dot : "var(--border)" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span aria-hidden="true" style={{ display: "inline-block", width: 28, height: 28, borderRadius: 7, backgroundColor: "#fff", border: "1px solid var(--border)", boxShadow: `inset 0 -2px 0 ${pm.dot}`, backgroundImage: `url(${LOGOS[label]})`, backgroundSize: 17, backgroundPosition: "center", backgroundRepeat: "no-repeat", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{label}</span>
                </div>
              </div>
              <div className="design-posture-counts">
                <div><strong>{documented}</strong><span>Documented</span></div>
                <div><strong>{counts.None}</strong><span>None</span></div>
                <div><strong>{counts.Unknown}</strong><span>Not documented</span></div>
                <div><strong>{summary.parityUnknownRows.length}</strong><span>Parity not established</span></div>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, color: isExpanded ? pm.dot : "var(--faint)", lineHeight: 1.45, marginTop: 7, fontWeight: 800 }}>
                {isExpanded ? "Hide row detail" : "Show row detail"}
              </div>
            </button>
          );
        })}
      </div>
      {expandedSummary && (
        <div id={`evidence-detail-${expandedSummary.providerKey}`} className="design-coverage-detail" style={{ borderColor: expandedSummary.pm.border }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: expandedSummary.pm.dot, letterSpacing: "0.1em", fontWeight: 900, textTransform: "uppercase" }}>
                {expandedSummary.label} evidence posture
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.55, marginTop: 4 }}>
                Availability groups are mutually exclusive. The parity group is separate because parity is not inferred from availability.
              </div>
            </div>
            <button
              type="button"
              className="hb"
              onClick={() => setExpandedProvider(null)}
              style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)", color: "var(--muted)", padding: "5px 9px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 800 }}
            >
              Close
            </button>
          </div>
          <div className="design-evidence-columns">
            {[
              { title: `Documented availability (${expandedSummary.evidenceRows.length})`, rows: expandedSummary.evidenceRows },
              { title: `Officially unavailable (${expandedSummary.unavailableRows.length})`, rows: expandedSummary.unavailableRows },
              { title: `Not officially documented (${expandedSummary.unknownRows.length})`, rows: expandedSummary.unknownRows },
              { title: `Parity not established (${expandedSummary.parityUnknownRows.length})`, rows: expandedSummary.parityUnknownRows },
            ].map(group => (
              <div key={group.title} style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "var(--faint)", letterSpacing: "0.08em", fontWeight: 900, textTransform: "uppercase", marginBottom: 8 }}>
                  {group.title}
                </div>
                <div className="design-evidence-list">
                  {group.rows.length === 0 && (
                    <div style={{ padding: "10px 11px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--muted)", fontSize: 11 }}>
                      No visible rows in this group.
                    </div>
                  )}
                  {group.rows.map(row => {
                    const statusStyle = GOV_AVAIL_STYLES[row.status] || GOV_AVAIL_STYLES.Unknown;
                    return (
                      <div key={`${expandedSummary.providerKey}-${group.title}-${row.cap}`} className="design-evidence-row">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 800, lineHeight: 1.35 }}>{row.cap}</div>
                            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>{row.category}</div>
                          </div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 6px", borderRadius: 5, background: statusStyle.bg, color: statusStyle.fg, border: `1px solid ${statusStyle.border}`, fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: statusStyle.dot }} />
                            {govAvailabilityDisplay(row.status)}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: "var(--ink2)", lineHeight: 1.45, marginTop: 7 }}>{row.service}</div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "var(--muted)" }}>
                          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: (PARITY_STYLES[row.parity] || PARITY_STYLES.Unknown).dot }} />
                          Parity {parityLagDisplay(row.parity)}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 7, fontSize: 9, color: "var(--muted)", lineHeight: 1.45 }}>
                          <div><strong style={{ color: "var(--text)" }}>Variant:</strong> {row.variant}</div>
                          <div><strong style={{ color: "var(--text)" }}>Last checked:</strong> {row.lastVerified}</div>
                        </div>
                        {(row.region || row.realmClass) && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 5, fontSize: 9, color: "var(--muted)", lineHeight: 1.45 }}>
                            <div><strong style={{ color: "var(--text)" }}>Region:</strong> {row.region || "Not structured"}</div>
                            <div><strong style={{ color: "var(--text)" }}>Realm:</strong> {row.realmClass || "Not structured"}</div>
                          </div>
                        )}
                        {row.note && (
                          <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.45, marginTop: 7 }}>{truncateText(row.note, 150)}</div>
                        )}
                        {row.source && (
                          <a href={row.source} target="_blank" rel="noopener noreferrer" className="design-source-link" style={{ marginTop: 8 }}>
                            Official source
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "var(--faint)", lineHeight: 1.55, marginTop: 10 }}>
            Last checked uses provider-specific dates when present, then capability-level dates. Region and realm class appear only when sourced in the matrix data.
          </div>
        </div>
      )}
    </section>
  );
}

function MatrixReadKey({ onDismiss, plain = false }) {
  const govLevels = ["Full", "Partial", "Limited", "None", "Unknown"];
  const parityLevels = ["None", "Minor", "Moderate", "Significant", "Unknown"];

  return (
    <section style={{ margin: plain ? 0 : "0 0 14px", padding: plain ? 0 : "13px 15px", border: plain ? "none" : "1px solid var(--border)", borderRadius: plain ? 0 : 10, background: plain ? "transparent" : "var(--panel)", boxShadow: plain ? "none" : "0 1px 2px var(--shadow)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>How to read this matrix</div>
          <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.5, marginTop: 4, maxWidth: 760 }}>
            Availability is documented regulated-environment presence. Parity is a separate commercial-to-regulated feature-gap signal. Unknown is shown as not documented or not established when public official evidence has not established a stronger claim.
          </div>
        </div>
        <button
          type="button"
          className="hb"
          onClick={onDismiss}
          aria-label="Hide matrix reading key"
          style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel-alt)", color: "var(--muted)", padding: "4px 8px", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
        >
          Hide
        </button>
      </div>
      <div className="design-read-key-grid">
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text)", marginBottom: 7 }}>Government availability</div>
          <div style={{ display: "grid", gap: 6 }}>
            {govLevels.map(level => {
              const style = GOV_AVAIL_STYLES[level] || GOV_AVAIL_STYLES.Unknown;
              return (
                <div key={level} style={{ display: "grid", gridTemplateColumns: "132px minmax(0, 1fr)", gap: 9, alignItems: "start" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content", padding: "2px 7px", borderRadius: 6, border: `1px solid ${style.border}`, background: style.bg, color: style.fg, fontSize: 10, fontWeight: 700 }}>
                    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: style.dot, flexShrink: 0 }} />
                    {govAvailabilityDisplay(level)}
                  </span>
                  <span style={{ fontSize: 10.5, lineHeight: 1.45, color: "var(--muted)" }}>{GOV_AVAILABILITY_GLOSSARY[level]}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text)", marginBottom: 7 }}>Parity lag</div>
          <div style={{ display: "grid", gap: 6 }}>
            {parityLevels.map(level => {
              const style = PARITY_STYLES[level] || PARITY_STYLES.Unknown;
              return (
                <div key={level} style={{ display: "grid", gridTemplateColumns: "132px minmax(0, 1fr)", gap: 9, alignItems: "start" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: style.fg, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700 }}>
                    <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: style.dot, flexShrink: 0 }} />
                    {level === "Unknown" ? "Not established" : level}
                  </span>
                  <span style={{ fontSize: 10.5, lineHeight: 1.45, color: "var(--muted)" }}>{PARITY_LAG_GLOSSARY[level]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function DesignMatrixView({ rows, activeProviders, selectedId, setSelectedId, tier, density = DEFAULT_MATRIX_DENSITY }) {
  const groupedLayers = useMemo(() => groupRowsByLayer(rows), [rows]);

  if (!rows.length) {
    return <div style={{ padding: "22px 0", fontSize: 13, color: "var(--muted)" }}>No capability rows match the current filters.</div>;
  }

  const compact = density === "Compact";
  const numProviders = activeProviders.length;
  const gridTemplateColumns = `minmax(${compact ? 210 : 240}px, 1.15fr) repeat(${numProviders}, minmax(${compact ? 140 : 160}px, 1fr))`;
  const minWidth = compact ? (numProviders > 3 ? 860 : 680) : (numProviders > 3 ? 980 : 760);
  const capabilityPad = compact ? "9px 13px" : "13px 16px";
  const providerPad = compact ? "9px 11px" : "12px 13px";
  const cellGap = compact ? 5 : 7;

  return (
    <div className="design-matrix-shell">
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)", boxShadow: "0 2px 10px var(--shadow)" }}>
        <div style={{ minWidth }}>
          <div style={{ display: "grid", gridTemplateColumns, position: "sticky", top: 0, zIndex: 5, background: "var(--head)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "11px 16px", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>
              Capability
            </div>
            {activeProviders.map(providerKey => {
              const label = providerLabelForKey(providerKey);
              const pm = PROVIDER_META[providerKey];
              return (
                <div key={providerKey} style={{ padding: "10px 13px", borderLeft: "1px solid var(--border2)", borderBottom: `2px solid ${pm.dot}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span aria-hidden="true" style={{ display: "inline-block", width: 24, height: 24, borderRadius: 6, backgroundColor: "#fff", border: "1px solid var(--border)", boxShadow: `inset 0 -2px 0 ${pm.dot}`, backgroundImage: `url(${LOGOS[label]})`, backgroundSize: 14, backgroundPosition: "center", backgroundRepeat: "no-repeat", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>

        {groupedLayers.map(layer => {
          const layerStyle = DESIGN_LAYER_STYLES[layer.layer] || DESIGN_LAYER_STYLES["Operating Model"];
          const layerCount = layer.categories.reduce((total, category) => total + category.items.length, 0);

          return (
            <section key={layer.layer}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "var(--head)", borderTop: `2px solid ${layerStyle.color}`, borderBottom: "1px solid var(--border2)" }}>
                <span aria-hidden="true" style={{ display: "inline-block", width: 16, height: 16, background: layerStyle.color, WebkitMaskImage: `url(${ICONS.layers})`, maskImage: `url(${ICONS.layers})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.02em", color: "var(--text)" }}>{layer.layer}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--faint)" }}>{layerCount}</span>
              </div>

              {layer.categories.map(category => (
                <div key={category.category}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 18px", background: "var(--rowalt)", borderBottom: "1px solid var(--border2)" }}>
                    <CategoryIcon category={category.category} size={13} />
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", color: "var(--muted)", textTransform: "uppercase" }}>{category.category}</span>
                  </div>
                  {category.items.map(row => {
                    const selected = selectedId === row.cap;
                    const aiBadge =
                      row.ai === "AI_NATIVE" ? { label: "AI-native", bg: "#ece4fb", fg: "#6b3fc0" } :
                      row.ai === "AI_CAPABLE" ? { label: "AI-capable", bg: "#d9efeb", fg: "#0d7d70" } :
                      null;
                    return (
                      <div key={row.cap} style={{ display: "grid", gridTemplateColumns, borderBottom: "1px solid var(--border2)", background: selected ? "var(--selected-bg)" : undefined, transition: "background .12s" }}>
                        <button
                          className="hb"
                          type="button"
                          onClick={() => setSelectedId(selected ? null : row.cap)}
                          aria-label={`${row.cap} detail`}
                          style={{ padding: capabilityPad, textAlign: "left", display: "flex", flexDirection: "column", gap: compact ? 4 : 6, justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--text)", fontFamily: "inherit" }}
                        >
                          <span style={{ fontSize: compact ? 12.5 : 13.5, fontWeight: 600, lineHeight: 1.3 }}>{row.cap}</span>
                          {aiBadge && !compact && (
                            <span style={{ alignSelf: "flex-start", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 4, background: aiBadge.bg, color: aiBadge.fg }}>
                              {aiBadge.label}
                            </span>
                          )}
                        </button>
                        {activeProviders.map(providerKey => {
                          const label = providerLabelForKey(providerKey);
                          const provider = row.providers?.[label];
                          if (!provider) {
                            return <div key={providerKey} style={{ borderLeft: "1px solid var(--border2)", padding: "12px 13px" }} />;
                          }
                          const govStyle = getDesignGovStyle(provider.gov);
                          const parStyle = PARITY_STYLES[provider.lag] || PARITY_STYLES.Unknown;
                          const previewText = compact ? "" : getProviderPreviewText(provider, tier);
                          const quickLinks = compact ? [] : getProviderQuickLinks(provider);
                          return (
                            <div
                              key={providerKey}
                              className="hb"
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedId(selected ? null : row.cap)}
                              onKeyDown={event => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedId(selected ? null : row.cap);
                                }
                              }}
                              aria-label={`${row.cap} ${label} detail`}
                              style={{ border: "none", borderLeft: "1px solid var(--border2)", padding: providerPad, display: "flex", flexDirection: "column", gap: cellGap, justifyContent: "center", background: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text)", textAlign: "left" }}
                            >
                              <span style={{ fontSize: compact ? 10.5 : 11.5, fontWeight: 500, lineHeight: 1.3, color: "var(--ink2)" }}>{provider.svc || "Not mapped"}</span>
                              {previewText && (
                                <span style={{ fontSize: 9.5, lineHeight: 1.45, color: "var(--muted)" }}>{previewText}</span>
                              )}
                              {quickLinks.length > 0 && (
                                <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                  {quickLinks.map(link => (
                                    <a
                                      key={link.label}
                                      className="design-provider-cell-link"
                                      href={link.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={event => event.stopPropagation()}
                                      onKeyDown={event => event.stopPropagation()}
                                    >
                                      {link.label}
                                    </a>
                                  ))}
                                </span>
                              )}
                              <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px 3px 8px", borderRadius: 6, background: govStyle.bg, border: `1px solid ${govStyle.border}` }}>
                                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: govStyle.dot, border: provider.gov === "Unknown" ? `1.5px solid ${govStyle.fg}` : "none", flexShrink: 0 }} />
                                <span style={{ fontSize: compact ? 10.5 : 11.5, fontWeight: 600, color: govStyle.fg }}>{govAvailabilityDisplay(provider.gov)}</span>
                              </span>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--muted)" }}>
                                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: parStyle.dot, flexShrink: 0 }} />
                                {parityLagDisplay(provider.lag)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function ResidencyOfferings({ offerings }) {
  if (!Array.isArray(offerings) || offerings.length === 0) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 7 }}>Residency offerings</div>
      <div style={{ display: "grid", gap: 7 }}>
        {offerings.map((offering, index) => (
          <div key={`${offering.offering || "offering"}-${index}`} style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px" }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", marginBottom: 5 }}>
              <div style={{ color: "var(--text)", fontSize: 11.5, fontWeight: 800, lineHeight: 1.35 }}>{offering.offering}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {offering.status && (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, fontWeight: 800, color: "var(--selected-text)", border: "1px solid var(--selected-border)", background: "var(--selected-bg)", borderRadius: 5, padding: "2px 5px" }}>{offering.status}</span>
                )}
                {offering.firstParty === false && (
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, fontWeight: 800, color: "var(--warn-text)", border: "1px solid var(--warn-border)", background: "var(--warn-bg)", borderRadius: 5, padding: "2px 5px" }}>Partner-operated</span>
                )}
              </div>
            </div>
            {offering.geography && <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.45, marginBottom: 4 }}>{offering.geography}</div>}
            {offering.guarantee && <div style={{ fontSize: 11.5, color: "var(--ink2)", lineHeight: 1.5 }}>{offering.guarantee}</div>}
            {offering.source && (
              <a href={offering.source} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", marginTop: 6, fontSize: 10.5, color: "var(--link)", textDecoration: "none", fontWeight: 700 }}>Official source</a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DesignMatrixDetail({ row, activeProviders, tier, onClose }) {
  if (!row) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, background: "rgba(15,15,14,.32)", backdropFilter: "blur(1.5px)", zIndex: 40 }}
      />
      <aside
        role="dialog"
        aria-label={`${row.cap} detail`}
        className="design-detail-panel"
        style={{
          position: "fixed", top: 0, right: 0, height: "100vh",
          width: "min(440px, 92vw)", background: "var(--panel)",
          borderLeft: "1px solid var(--border)", zIndex: 50,
          boxShadow: "-8px 0 30px var(--shadow)",
          display: "flex", flexDirection: "column",
          animation: "cimSlide .26s cubic-bezier(.2,.7,.3,1) both",
        }}
      >
        <div style={{ padding: "20px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexShrink: 0 }}>
          <div>
            <div style={{ display: "inline-flex", maxWidth: "100%", padding: "3px 7px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--category-bg)", color: "var(--category-text)", fontSize: 8, letterSpacing: "0.08em", marginBottom: 9, fontWeight: 800 }}>
              <CategoryLabel category={row.cat} size={12} uppercase />
            </div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.25, color: "var(--text)" }}>{row.cap}</h2>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 7 }}>
              {row.tags.map(tag => <TagBadge key={tag} tagKey={tag} />)}
            </div>
            {row.lastVerified && <div style={{ marginTop: 6 }}><VerifiedStamp date={row.lastVerified} /></div>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close detail panel"
            style={{ background: "var(--panel-alt)", border: "1px solid var(--border)", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "var(--muted)", fontSize: 15, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >x</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "18px 22px" }}>
          {row.architectureNotes && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 5 }}>Architecture note</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.62, color: "var(--ink2)" }}>{row.architectureNotes}</p>
            </div>
          )}
          {row.operationalConsiderations && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 5 }}>Operations note</div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.62, color: "var(--ink2)" }}>{row.operationalConsiderations}</p>
            </div>
          )}

          {activeProviders.map(providerKey => {
            const label = providerLabelForKey(providerKey);
            const provider = row.providers?.[label];
            const pm = PROVIDER_META[providerKey];
            if (!provider) return null;
            const govStyle = getDesignGovStyle(provider.gov);
            const parStyle = PARITY_STYLES[provider.lag] || PARITY_STYLES.Unknown;
            const tierNote = tier ? provider.tierNotes?.[tier] : null;
            const parityReasoning = getParityReasoning(provider);
            const depthItems = [
              { label: "Constraints", value: formatDepthValue(provider.constraints) },
              { label: "Cost model", value: formatCostModel(provider.costModel) },
              { label: "PQC readiness", value: formatPqcReadiness(provider.pqcReadiness) },
              { label: "Residency", value: formatResidencySummary(provider.residency) },
              { label: "FedRAMP", value: formatFedramp(provider.fedramp, provider.fedrampLevel) },
              { label: "DoD impact", value: provider.dodImpactLevel },
            ];

            return (
              <div key={providerKey} style={{ marginBottom: 14, padding: "14px 15px", borderRadius: 10, border: `1px solid ${pm.border}`, background: pm.bg }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span aria-hidden="true" style={{ display: "inline-block", width: 24, height: 24, borderRadius: 6, backgroundColor: "#fff", border: "1px solid var(--border)", boxShadow: `inset 0 -2px 0 ${pm.dot}`, backgroundImage: `url(${LOGOS[label]})`, backgroundSize: 14, backgroundPosition: "center", backgroundRepeat: "no-repeat", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "var(--muted)" }}>{label}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "10px 0" }}>{provider.svc || "Not mapped"}</div>
                {provider.formerNames?.length > 0 && (
                  <div style={{ marginBottom: 10, fontSize: 11, color: "var(--muted)", lineHeight: 1.45 }}>
                    <strong style={{ color: "var(--text)" }}>Formerly: </strong>{provider.formerNames.join(" / ")}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 12 }}>
                  <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 11px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 6 }}>Gov availability</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 3, background: govStyle.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{govAvailabilityDisplay(provider.gov)}</span>
                    </div>
                  </div>
                  <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 11px" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 6 }}>Parity lag</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: parStyle.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{parityLagDisplay(provider.lag)}</span>
                    </div>
                  </div>
                </div>
                {parityReasoning && (
                  <div style={{ marginBottom: 10, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 5 }}>Parity reasoning</div>
                    <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.5, color: "var(--ink2)" }}>{parityReasoning}</p>
                  </div>
                )}
                {provider.variant && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 5 }}>Regulated variant</div>
                    <div style={{ fontSize: 12, color: "var(--ink2)" }}>{provider.variant}</div>
                  </div>
                )}
                <ResidencyOfferings offerings={provider.residency} />
                {(provider.region || provider.realmClass || provider.lastVerified) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 10 }}>
                    {provider.region && (
                      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 5 }}>Region</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink2)", lineHeight: 1.4 }}>{provider.region}</div>
                      </div>
                    )}
                    {provider.realmClass && (
                      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 5 }}>Realm class</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink2)", lineHeight: 1.4 }}>{provider.realmClass}</div>
                      </div>
                    )}
                    {provider.lastVerified && (
                      <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px" }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 5 }}>Provider checked</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink2)", lineHeight: 1.4 }}>{provider.lastVerified}</div>
                      </div>
                    )}
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 7 }}>Schema depth</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 9 }}>
                    {depthItems.map(item => (
                      <ProviderDepthField key={item.label} label={item.label} value={item.value} />
                    ))}
                  </div>
                </div>
                {provider.note && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--faint)", marginBottom: 5 }}>Source notes</div>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--ink2)" }}>{provider.note}</p>
                  </div>
                )}
                {tierNote && (
                  <div style={{ padding: "8px 10px", borderLeft: "2px solid var(--selected-border)", background: "var(--tier-bg)", color: "var(--text)", fontSize: 11, lineHeight: 1.45, marginBottom: 10 }}>
                    <strong style={{ color: "var(--selected-text)" }}>{tier}: </strong>{tierNote}
                  </div>
                )}
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {provider.doc && <a href={provider.doc} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 500, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--link)", textDecoration: "none" }}>Docs</a>}
                  {provider.govdoc && <a href={provider.govdoc} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 500, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--link)", textDecoration: "none" }}>Gov docs</a>}
                  {provider.price && <a href={provider.price} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 500, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--link)", textDecoration: "none" }}>Pricing</a>}
                  {provider.compliance && <a href={provider.compliance} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 500, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--link)", textDecoration: "none" }}>Compliance</a>}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "12px 22px", borderTop: "1px solid var(--border)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--faint)", flexShrink: 0 }}>
          Cross-provider comparison. Verify against official docs.
        </div>
      </aside>
    </>
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

function CollapsibleInfoBar({ title, summary, open, onToggle, children }) {
  return (
    <section className={`collapsible-info ${open ? "open" : ""}`}>
      <button
        type="button"
        className="hb collapsible-info-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span aria-hidden="true" style={{ color: "var(--link)", fontSize: 11, lineHeight: 1 }}>{open ? "v" : ">"}</span>
          <span style={{ color: "var(--text)", fontWeight: 900 }}>{title}</span>
        </span>
        <span className="collapsible-info-summary">{summary}</span>
      </button>
      {open && <div className="collapsible-info-body">{children}</div>}
    </section>
  );
}

function OverviewViewDesign({ cards, meta }) {
  return (
    <>
      <ViewHero
        eyebrow="Overview"
        title="A quick map of the intelligence surface"
        body="Start with the matrix for service decisions, then branch into patterns, controls, provider news, operational status, AI releases, and transparency records."
        meta={[
          <StatTile key="capabilities" label="CAPABILITIES" value={CAPABILITIES.length} />,
          <StatTile key="providers" label="PROVIDERS" value={PROVIDERS.length} />,
          <StatTile key="version" label="VERSION" value={meta.version} />,
        ]}
      />
      <div className="overview-grid">
        {cards.map(card => (
          <button
            type="button"
            key={card.id}
            className="hb overview-card"
            onClick={card.onClick}
          >
            <div className="overview-card-head">
              <span aria-hidden="true" className="overview-card-icon" style={{ WebkitMaskImage: `url(${ICONS[card.iconKey]})`, maskImage: `url(${ICONS[card.iconKey]})` }} />
              <span>{card.label}</span>
            </div>
            <div className="overview-card-body">{card.description}</div>
            <div className="overview-card-stat">{card.stat}</div>
          </button>
        ))}
      </div>
    </>
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
function AIProviderStatusRow({ cap, providerKey, selected, onOpen }) {
  const provider = cap.providers[providerKey];
  const label = PROVIDER_META[providerKey]?.label || providerKey;
  if (!provider) return null;

  return (
    <div
      className="ai-focus-provider-row hb"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(cap.capability)}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(cap.capability);
        }
      }}
      aria-label={`${cap.capability} ${label} detail`}
      style={{ background: selected ? "var(--selected-bg)" : "transparent" }}
    >
      <span aria-hidden="true" className="ai-focus-provider-logo" style={{ backgroundImage: `url(${LOGOS[label]})` }} />
      <span className="ai-focus-provider-service">{provider.service || "Not mapped"}</span>
      <span className="ai-focus-provider-badge"><GovBadge avail={provider.govAvailability} /></span>
    </div>
  );
}

function AIViewDesign({ caps, activeProviders, selectedId, setSelectedId }) {
  const aiCaps = caps.filter(c => c.tags.some(t => ["AI_NATIVE", "AI_CAPABLE"].includes(t)));
  const groups = [
    {
      key: "AI_NATIVE",
      label: "AI-native",
      note: "Capabilities that are themselves AI products.",
      tone: "#6d5bd0",
      bg: "#ece7fb",
    },
    {
      key: "AI_CAPABLE",
      label: "AI-capable",
      note: "Capabilities that directly support AI workloads.",
      tone: "#0f766e",
      bg: "#dcefed",
    },
  ].map(group => ({
    ...group,
    items: aiCaps.filter(cap => cap.tags.includes(group.key)),
  }));

  return (
    <div>
      <div style={{ color: "var(--ink2)", fontSize: 14, lineHeight: 1.55, maxWidth: 980, margin: "0 0 18px" }}>
        Capabilities that are themselves AI products (AI-native) or directly enable AI workloads (AI-capable), with government availability and service mapping per provider. Click any provider row for full detail.
      </div>
      {!aiCaps.length && (
        <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No AI-focused capabilities match the current filter.</div>
      )}
      {groups.filter(group => group.items.length).map(group => (
        <section key={group.key} style={{ marginTop: 18 }}>
          <div className="ai-focus-section-head">
            <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 7, background: group.bg, color: group.tone, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 900, letterSpacing: "0.03em" }}>
              {group.label}
            </span>
            <span style={{ color: "var(--faint)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
              {group.items.length} capabilities
            </span>
            <span style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1.45 }}>
              {group.note}
            </span>
          </div>
          <div className="ai-focus-grid">
            {group.items.map(cap => (
              <article key={cap.capability} className="ai-focus-card">
                <div className="ai-focus-card-head">
                  <CategoryIcon category={cap.category} size={16} />
                  <h3>{cap.capability}</h3>
                </div>
                <div className="ai-focus-provider-list">
                  {activeProviders.map(providerKey => (
                    <AIProviderStatusRow
                      key={providerKey}
                      cap={cap}
                      providerKey={providerKey}
                      selected={selectedId === cap.capability}
                      onOpen={setSelectedId}
                    />
                  ))}
                </div>
              </article>
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

function HistoryViewDesign({ items, meta }) {
  const sortedItems = useMemo(() => (
    [...items].sort((a, b) => a.year - b.year || (a.date || "").localeCompare(b.date || ""))
  ), [items]);
  const years = Array.from(new Set(sortedItems.map(item => item.year)));

  return (
    <div>
      <ViewHero
        eyebrow="CLOUD TIMELINE"
        title="Provider cloud journey chronological"
        body={meta.scopeNote}
        meta={[
          <StatTile key="events" label="EVENTS" value={items.length} />,
          <StatTile key="years" label="YEARS" value={years.length} />,
          <VerifiedStamp key="verified" date={meta.lastVerified} />,
        ]}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {Object.entries(HISTORY_PHASE_STYLES).map(([phase, style]) => (
          <span key={phase} style={{ fontSize: 9, padding: "4px 10px", borderRadius: 6, border: `1px solid ${style.border}`, background: style.bg, color: style.fg, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
            {phase}
          </span>
        ))}
      </div>

      {!sortedItems.length && (
        <div style={{ padding: "16px 0", fontSize: 13, color: "var(--muted)" }}>No history milestones match the current filter.</div>
      )}

      <div style={{ display: "grid", gap: 16 }}>
        {sortedItems.map(item => {
          const pm = PROVIDER_META[item.provider] || {};
          const label = providerLabelForKey(item.provider);
          const phaseStyle = HISTORY_PHASE_STYLES[item.phase] || HISTORY_PHASE_STYLES["Commercial cloud"];
          return (
            <div key={item.id} className="design-timeline-row">
              <div style={{ textAlign: "right", paddingTop: 5 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{item.year}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "var(--faint)", marginTop: 3 }}>{item.dateLabel}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <span aria-hidden="true" style={{ display: "inline-block", width: 26, height: 26, borderRadius: 7, backgroundColor: "#fff", border: "1px solid var(--border)", boxShadow: `inset 0 -2px 0 ${pm.dot}`, backgroundImage: `url(${LOGOS[label]})`, backgroundSize: 15, backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
                </div>
              </div>

              <article style={{ padding: "14px 16px", borderRadius: 10, border: "1px solid var(--border)", borderLeft: `3px solid ${pm.dot || "var(--border)"}`, background: "var(--panel)", boxShadow: "0 1px 3px var(--shadow)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 9, padding: "3px 9px", borderRadius: 6, border: `1px solid ${phaseStyle.border}`, background: phaseStyle.bg, color: phaseStyle.fg, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                    {item.phase}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: pm.dot, fontWeight: 700 }}>{label}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: "var(--text)", marginBottom: 7 }}>{item.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.58 }}>{item.summary}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", marginTop: 10 }}>
                  {item.scope.map(scope => (
                    <span key={scope} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--panel-alt)", color: "var(--muted)", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{scope}</span>
                  ))}
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--panel-alt)", color: "var(--link)", textDecoration: "none" }}>
                    {item.sourceLabel}
                  </a>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TransparencyMap({ items, visibleItems, officialRecords, coveragePct }) {
  const itemByState = Object.fromEntries(items.map(item => [item.state, item]));
  const visibleStates = new Set(visibleItems.map(item => item.state));

  return (
    <section className="transparency-map-card">
      <div className="transparency-map-head">
        <div>
          <div style={{ color: "#b45309", fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", marginBottom: 5 }}>AI TRANSPARENCY MAP</div>
          <div style={{ color: "var(--text)", fontSize: 13, fontWeight: 900, lineHeight: 1.3 }}>Official state and DC public records</div>
          <div style={{ color: "var(--muted)", fontSize: 10, lineHeight: 1.55, marginTop: 4 }}>
            {officialRecords} of {items.length} state/DC rows have official-source documents linked.
          </div>
        </div>
        <div className="transparency-coverage-meter">
          <strong>{coveragePct}%</strong>
          <span>official records</span>
        </div>
      </div>

      <div className="transparency-map-scroll" aria-label="United States AI transparency source map">
        <div className="transparency-map-grid">
          {Object.entries(STATE_TILE_POSITIONS).map(([state, [row, column]]) => {
            const item = itemByState[state];
            if (!item) return null;
            const style = TRANSPARENCY_STATUS_STYLES[item.status] || TRANSPARENCY_STATUS_STYLES.Unknown;
            const muted = visibleItems.length > 0 && !visibleStates.has(state);
            const label = `${item.stateName}: ${item.status}${item.url ? ". Official source available." : ". No official source linked."}`;
            const tileStyle = {
              gridRow: row,
              gridColumn: column,
              borderColor: style.border,
              background: style.bg,
              color: style.fg,
              opacity: muted ? 0.34 : 1,
            };
            const content = (
              <>
                <strong>{state}</strong>
                <span>{item.status === "Unknown" ? "No doc" : item.status}</span>
              </>
            );
            return item.url ? (
              <a
                key={state}
                className="transparency-state-tile"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                aria-label={label}
                style={tileStyle}
              >
                {content}
              </a>
            ) : (
              <span
                key={state}
                className="transparency-state-tile disabled"
                title={label}
                aria-label={label}
                style={tileStyle}
              >
                {content}
              </span>
            );
          })}
        </div>
      </div>

      <div className="transparency-map-legend">
        {TRANSPARENCY_STATUS_ORDER.filter(status => status !== "All").map(status => {
          const style = TRANSPARENCY_STATUS_STYLES[status] || TRANSPARENCY_STATUS_STYLES.Unknown;
          return (
            <span key={status} style={{ borderColor: style.border, background: style.bg, color: style.fg }}>
              {status}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function TransparencyViewDesign({ items, meta }) {
  const federalContext = meta.federalContext || {};
  const counts = TRANSPARENCY_STATUS_ORDER
    .filter(status => status !== "All")
    .map(status => ({ status, count: items.filter(item => item.status === status).length }))
    .filter(item => item.count);
  const officialRecords = TRANSPARENCY.filter(item => item.url).length;
  const coveragePct = Math.round((officialRecords / Math.max(TRANSPARENCY.length, 1)) * 100);

  return (
    <div>
      <ViewHero
        eyebrow="STATE AI TRANSPARENCY"
        title="Point-in-time public AI governance record"
        body={meta.scopeNote}
        meta={[
          <StatTile key="rows" label="ROWS" value={items.length} tone="#b45309" />,
          <StatTile key="records" label="OFFICIAL RECORDS" value={`${coveragePct}%`} tone="#16a34a" />,
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

      <TransparencyMap
        items={TRANSPARENCY}
        visibleItems={items}
        officialRecords={officialRecords}
        coveragePct={coveragePct}
      />

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

function StatusViewDesign({ sources, meta }) {
  const categories = [
    { id: "cloud-provider", label: "Cloud Providers" },
    { id: "adjacent-platform", label: "Adjacent Platforms" },
  ];
  const categoryCounts = Object.fromEntries(categories.map(category => [
    category.id,
    sources.filter(source => source.category === category.id).length,
  ]));

  return (
    <div>
      <ViewHero
        eyebrow="OPERATIONAL STATUS"
        title="Official status pages and incident history"
        body={meta.scopeNote}
        meta={[
          <StatTile key="sources" label="SOURCES" value={sources.length} />,
          <StatTile key="clouds" label="CLOUDS" value={categoryCounts["cloud-provider"] || 0} />,
          <VerifiedStamp key="verified" date={meta.last_verified} />,
        ]}
      />

      {categories.map(category => {
        const group = sources.filter(source => source.category === category.id);
        if (!group.length) return null;
        return (
          <section key={category.id} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "var(--faint)", letterSpacing: "0.1em", fontWeight: 900, textTransform: "uppercase", margin: "0 0 9px" }}>
              {category.label}
            </div>
            <div className="design-framework-grid">
              {group.map(source => {
                const pm = PROVIDER_META[source.provider] || {};
                const logo = LOGOS[source.providerName];
                const accent = pm.dot || "#64748b";
                return (
                  <article key={source.id} className="design-secondary-card" style={{ borderTop: `3px solid ${accent}` }}>
                    <div className="design-secondary-card-head">
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                        <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: "#fff", border: "1px solid var(--border)", boxShadow: `inset 0 -2px 0 ${accent}`, backgroundImage: logo ? `url(${logo})` : "none", backgroundSize: 18, backgroundPosition: "center", backgroundRepeat: "no-repeat", flexShrink: 0, color: accent, fontSize: 10, fontWeight: 900 }}>
                          {!logo && source.providerName.slice(0, 2).toUpperCase()}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 9, color: accent, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 5 }}>{source.providerName}</div>
                          <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 900, lineHeight: 1.3 }}>{source.name}</div>
                        </div>
                      </div>
                      <VerifiedStamp date={source.lastVerified} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink2)", lineHeight: 1.6, marginBottom: 10 }}>{source.summary}</div>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      <a href={source.statusUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">Live status</a>
                      {source.historyUrl && <a href={source.historyUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">History</a>}
                      {source.docsUrl && <a href={source.docsUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">Docs</a>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AiWatchViewDesign({ sources, meta }) {
  const categories = [
    { id: "frontier-model-lab", label: "Frontier Model Labs", tone: "#0b62b9" },
    { id: "open-model-lab", label: "Open Model Labs", tone: "#0f766e" },
    { id: "multimodal-model-lab", label: "Multimodal Model Labs", tone: "#b45309" },
  ];
  const categoryCounts = Object.fromEntries(categories.map(category => [
    category.id,
    sources.filter(source => source.category === category.id).length,
  ]));

  return (
    <div>
      <ViewHero
        eyebrow="AI LAB WATCH"
        title="Official frontier and foundation-model release sources"
        body={meta.scopeNote}
        meta={[
          <StatTile key="sources" label="SOURCES" value={sources.length} tone="#0b62b9" />,
          <StatTile key="frontier" label="FRONTIER" value={categoryCounts["frontier-model-lab"] || 0} />,
          <VerifiedStamp key="verified" date={meta.last_verified} />,
        ]}
      />

      {categories.map(category => {
        const group = sources.filter(source => source.category === category.id);
        if (!group.length) return null;
        return (
          <section key={category.id} style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, color: "var(--faint)", letterSpacing: "0.1em", fontWeight: 900, textTransform: "uppercase", margin: "0 0 9px" }}>
              {category.label}
            </div>
            <div className="design-framework-grid">
              {group.map(source => {
                const modelDetails = Array.isArray(source.modelDetails) ? source.modelDetails : [];
                return (
                <article key={source.id} className="design-secondary-card" style={{ borderTop: `3px solid ${category.tone}` }}>
                  <div className="design-secondary-card-head">
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
                      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, backgroundColor: "var(--panel-alt)", border: "1px solid var(--border)", boxShadow: `inset 0 -2px 0 ${category.tone}`, flexShrink: 0, color: category.tone, fontSize: 10, fontWeight: 900 }}>
                        {source.shortName.slice(0, 2).toUpperCase()}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, color: category.tone, fontWeight: 900, letterSpacing: "0.08em", marginBottom: 5 }}>{source.name}</div>
                        <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 900, lineHeight: 1.3 }}>{source.modelFamily}</div>
                      </div>
                    </div>
                    <VerifiedStamp date={source.lastVerified} />
                  </div>
                  <div className="ai-watch-model-strip">
                    <span>{source.shortName}</span>
                    <strong>Official model docs are the source of truth for current model names.</strong>
                  </div>
                  {modelDetails.length > 0 ? (
                    <div className="ai-watch-model-detail-list" aria-label={`${source.name} tracked model details`}>
                      {modelDetails.map(detail => (
                        <div key={detail.name} className="ai-watch-model-detail">
                          <div className="ai-watch-model-detail-head">
                            <strong>{detail.name}</strong>
                            {detail.releaseDate && <span>Released {detail.releaseDate}</span>}
                          </div>
                          <div className="ai-watch-model-best">{detail.bestFor}</div>
                          {detail.sourceNote && <div className="ai-watch-model-source-note">{detail.sourceNote}</div>}
                          <div className="ai-watch-model-links">
                            <a href={detail.docUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">Official doc</a>
                            {detail.releaseNotesUrl && <a href={detail.releaseNotesUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">Release/update</a>}
                            <VerifiedStamp date={detail.lastVerified} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : Array.isArray(source.models) && source.models.length > 0 && (
                    <div className="ai-watch-model-chip-row" aria-label={`${source.name} tracked model names`}>
                      {source.models.map(model => (
                        <span key={model} className="ai-watch-model-chip">{model}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--ink2)", lineHeight: 1.6, marginBottom: 10 }}>{source.summary}</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {source.newsUrl && <a href={source.newsUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">News</a>}
                    {source.docsUrl && <a href={source.docsUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">Model docs</a>}
                    {source.releaseNotesUrl && <a href={source.releaseNotesUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">Release notes</a>}
                    {source.safetyUrl && <a href={source.safetyUrl} target="_blank" rel="noopener noreferrer" className="design-source-link">Safety</a>}
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ProviderNewsViewDesign({ items }) {
  const providerCounts = PROVIDERS.map(provider => ({
    provider,
    label: providerLabelForKey(provider),
    count: items.filter(item => item.provider?.toLowerCase() === provider).length,
  }));

  return (
    <>
      <ViewHero
        eyebrow="Provider News"
        title="Official provider announcements and tracked changes"
        body="Tracked announced, preview, deprecated, and upcoming cloud-provider changes stay out of the matrix path but remain available for planning review."
        meta={[
          <StatTile key="items" label="ITEMS" value={items.length} />,
          <VerifiedStamp key="reviewed" date={UPCOMING_META.last_reviewed} />,
          ...providerCounts.map(group => (
            <StatTile key={group.provider} label={group.label.toUpperCase()} value={group.count} tone={PROVIDER_META[group.provider].dot} />
          )),
        ]}
      />
      <UpcomingBanner items={items} />
    </>
  );
}

// -- UPCOMING BANNER ---------------------------------------------------------
function UpcomingBanner({ items }) {
  if (!items.length) return null;
  const providerGroups = PROVIDERS.map(providerKey => {
    const label = providerLabelForKey(providerKey);
    const providerItems = items.filter(item => item.provider?.toLowerCase() === providerKey);
    return {
      providerKey,
      label,
      items: providerItems,
      visibleItems: providerItems,
    };
  });

  return (
    <div className="global-news-panel open" style={{ marginBottom: 14, borderRadius: 6, border: "1px solid #b45309", background: "var(--panel)", overflow: "hidden" }}>
      <div style={{ padding: "8px 14px", background: "var(--panel-alt)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", color: "#b45309" }}>GLOBAL CLOUD PROVIDER NEWS</div>
          <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
            Official announced, preview, deprecated, and upcoming changes by provider. Showing all {items.length} tracked item(s).
          </div>
        </div>
        <VerifiedStamp date={UPCOMING_META.last_reviewed} />
      </div>
      <div className="global-news-grid" style={{ padding: "10px 14px", background: "var(--panel)" }}>
        {providerGroups.map(group => {
          const pm = PROVIDER_META[group.providerKey] || {};
          return (
            <section key={group.providerKey} className="global-news-column" style={{ borderTop: `3px solid ${pm.dot || "var(--border)"}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 9 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <span aria-hidden="true" style={{ display: "inline-block", width: 22, height: 22, borderRadius: 6, backgroundColor: "#fff", border: "1px solid var(--border)", boxShadow: `inset 0 -2px 0 ${pm.dot || "var(--border)"}`, backgroundImage: `url(${LOGOS[group.label]})`, backgroundSize: 14, backgroundPosition: "center", backgroundRepeat: "no-repeat", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 900, color: pm.dot || "var(--text)", letterSpacing: "0.04em" }}>{group.label}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: "var(--muted)", fontWeight: 800 }}>{group.items.length}</span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {group.visibleItems.map(item => (
                  <article key={item.id} className="global-news-item">
                    <div className="global-news-status-row" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
                      <span style={{ fontSize: 7.5, padding: "2px 5px", borderRadius: 3, background: "#78350f", color: "#fbbf24", fontWeight: 800, letterSpacing: "0.04em" }}>
                        {item.status?.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 8, color: "var(--muted)", fontWeight: 800 }}>{item.category}</span>
                      {item.announced && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: "var(--muted)", fontWeight: 800 }}>Announced {item.announced}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text)", fontWeight: 800, lineHeight: 1.35 }}>{item.title}</div>
                    {item.expected_ga && (
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 8, color: "var(--muted)", marginTop: 4 }}>Expected: {item.expected_ga}</div>
                    )}
                    <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.45, marginTop: 5 }}>{item.detail}</div>
                    {item.source && <a href={item.source} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", marginTop: 6, display: "inline-block", fontWeight: 700, textDecoration: "none" }}>Official source</a>}
                  </article>
                ))}
                {!group.visibleItems.length && (
                  <div style={{ padding: "10px 11px", border: "1px dashed var(--border)", borderRadius: 6, color: "var(--muted)", fontSize: 9, lineHeight: 1.45 }}>
                    No tracked {group.label} provider news items.
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [mode, setMode] = useState(getInitialMode);
  const [activeProviders, setActiveProviders] = useState(getInitialProviders);
  const [selectedCategory, setSelectedCategory] = useState(getInitialCategory);
  const [selectedLayer, setSelectedLayer] = useState(getInitialLayer);
  const [selectedMatrixLens, setSelectedMatrixLens] = useState(getInitialMatrixLens);
  const [selectedMatrixAiScope, setSelectedMatrixAiScope] = useState(getInitialMatrixAiScope);
  const [matrixDensity, setMatrixDensity] = useState(getInitialMatrixDensity);
  const [showMatrixReadKey, setShowMatrixReadKey] = useState(false);
  const [showMatrixEvidencePanel, setShowMatrixEvidencePanel] = useState(false);
  const [showControlsContext, setShowControlsContext] = useState(false);
  const [showTransparencyContext, setShowTransparencyContext] = useState(false);
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
    syncFiltersToUrl({ mode, searchQuery, activeProviders, selectedCategory, selectedLayer, selectedMatrixLens, selectedMatrixAiScope, matrixDensity, selectedTier, selectedTransparencyStatus });
  }, [activeProviders, matrixDensity, mode, searchQuery, selectedCategory, selectedLayer, selectedMatrixAiScope, selectedMatrixLens, selectedTier, selectedTransparencyStatus]);

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

  const filteredMatrixCaps = useMemo(() => {
    let caps = filteredCaps;
    if (selectedMatrixLens === "gov") {
      caps = caps.filter(cap =>
        activeProviders.some(providerKey => {
          const provider = cap.providers[providerKey];
          return provider && (provider.govAvailability !== "Full" || (provider.parityLag && provider.parityLag !== "None"));
        })
      );
    } else if (selectedMatrixLens === "ai") {
      caps = caps.filter(c => c.tags.some(t => ["AI_NATIVE", "AI_CAPABLE"].includes(t)));
    }
    if (selectedLayer !== DEFAULT_LAYER) {
      caps = caps.filter(c => CATEGORY_TO_LAYER[c.category] === selectedLayer);
    }
    if (selectedMatrixAiScope !== DEFAULT_MATRIX_AI_SCOPE) {
      caps = caps.filter(c => c.aiClassification === selectedMatrixAiScope);
    }
    return caps;
  }, [activeProviders, filteredCaps, selectedLayer, selectedMatrixAiScope, selectedMatrixLens]);

  const matrixLensCounts = useMemo(() => ({
    all: filteredCaps.length,
    diff: filteredCaps.length,
    gov: filteredCaps.filter(cap =>
      activeProviders.some(providerKey => {
        const provider = cap.providers[providerKey];
        return provider && (provider.govAvailability !== "Full" || (provider.parityLag && provider.parityLag !== "None"));
      })
    ).length,
    ai: filteredCaps.filter(c => c.tags.some(t => ["AI_NATIVE", "AI_CAPABLE"].includes(t))).length,
  }), [activeProviders, filteredCaps]);

  const activeMatrixLens = MATRIX_LENSES.find(lens => lens.id === selectedMatrixLens) || MATRIX_LENSES[0];

  const filteredDesignRows = useMemo(
    () => filteredMatrixCaps.map(cap => DESIGN_ROW_MAP[cap.capability]).filter(Boolean),
    [filteredMatrixCaps]
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

  const filteredProviderNews = useMemo(() => {
    let items = UPCOMING.filter(item => activeProviders.includes(item.provider?.toLowerCase()));
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q)
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

  const filteredStatusSources = useMemo(() => {
    let items = STATUS_SOURCES;
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.providerName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
      );
    }
    return items;
  }, [searchQuery]);

  const filteredAiWatchSources = useMemo(() => {
    let items = AI_WATCH_SOURCES;
    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.shortName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.modelFamily.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
      );
    }
    return items;
  }, [searchQuery]);

  const exportData = useMemo(() => {
    if (mode === "patterns") return patternExport(filteredPatterns, activeProviders, CAPABILITY_MAP, FRAMEWORKS);
    if (mode === "controls") return controlExport(CONTROL_LENS, filteredControlFamilies, filteredComplianceFrameworks);
    if (mode === "history") return historyExport(filteredHistory, HISTORY_META);
    if (mode === "provider-news") return providerNewsExport(filteredProviderNews);
    if (mode === "transparency") return transparencyExport(filteredTransparency);
    if (mode === "status") return statusExport(filteredStatusSources);
    if (mode === "ai-watch") return aiWatchExport(filteredAiWatchSources);
    if (mode === "matrix" && selectedMatrixLens === "diff") return matrixExport("diff", "Service Equivalency", filteredMatrixCaps, activeProviders, selectedTier);
    if (mode === "matrix" && selectedMatrixLens === "gov") return matrixExport("gov", "Government Availability and Parity", filteredMatrixCaps, activeProviders, selectedTier);
    if (mode === "matrix" && selectedMatrixLens === "ai") return matrixExport("ai", "AI Focus", filteredMatrixCaps, activeProviders, selectedTier);
    return matrixExport("matrix", "Capability Matrix", filteredMatrixCaps, activeProviders, selectedTier);
  }, [activeProviders, filteredAiWatchSources, filteredComplianceFrameworks, filteredControlFamilies, filteredHistory, filteredMatrixCaps, filteredPatterns, filteredProviderNews, filteredStatusSources, filteredTransparency, mode, selectedMatrixLens, selectedTier]);

  const resultCount =
    mode === "patterns" ? filteredPatterns.length :
    mode === "controls" ? filteredControlFamilies.length + filteredComplianceFrameworks.length :
    mode === "history" ? filteredHistory.length :
    mode === "provider-news" ? filteredProviderNews.length :
    mode === "status" ? filteredStatusSources.length :
    mode === "ai-watch" ? filteredAiWatchSources.length :
    mode === "transparency" ? filteredTransparency.length :
    mode === "matrix" ? filteredMatrixCaps.length :
    filteredCaps.length;

  const modes = [
    { id: "overview",     label: "Overview",              iconKey: "blocks",        desc: "Map of each intelligence view" },
    { id: "matrix",       label: "Capability Matrix",     iconKey: "layers",        desc: "All capabilities by layer and tier" },
    { id: "patterns",     label: "Architecture Patterns", iconKey: "blocks",        desc: "Architecture planning overlays" },
    { id: "controls",     label: "Compliance & Controls", iconKey: "shield-check",  desc: "Framework references plus NIST 800-53 planning lens" },
    { id: "history",      label: "Cloud Timeline",        iconKey: "activity",      desc: "Provider cloud journey milestones" },
    { id: "provider-news", label: "Provider News",         iconKey: "activity",      desc: "Official provider announcements and upcoming changes" },
    { id: "status",       label: "Operational Status",    iconKey: "activity",      desc: "Official status pages and incident history" },
    { id: "ai-watch",     label: "AI Watch",              iconKey: "brain-circuit", desc: "Official model release source index" },
    { id: "transparency", label: "AI Transparency",       iconKey: "landmark",      desc: "State AI governance public record" },
  ];
  const providerGridModes = ["matrix", "patterns"];
  const providerControlModes = ["matrix", "patterns", "history", "provider-news"];
  const showProviderControls = providerControlModes.includes(mode);
  const showCategoryFilterControls = ["patterns", "controls"].includes(mode);
  const showTransparencyFilterControls = mode === "transparency";
  const showSecondaryFilterControls = showCategoryFilterControls || showTransparencyFilterControls;
  const contentMinWidthPx = mode === "overview" ? 0 : (providerGridModes.includes(mode) && activeProviders.length > 3 ? 1040 : 780);
  const showMatrixDensityControl = selectedMatrixLens !== "diff" && selectedMatrixLens !== "ai";
  const providerControlCard = (
    <div className="filter-control-card">
      <div className="filter-control-head">
        <span className="filter-control-label">COMPARE PROVIDERS</span>
        <span className="filter-control-note">{activeProviders.length} of {PROVIDERS.length} visible</span>
      </div>
      <div className="filter-chip-row">
        {PROVIDERS.map(p => (
          <button key={p} className="hb" onClick={() => toggleProvider(p)} style={{
            padding: "5px 10px", borderRadius: 5, fontSize: 10, fontWeight: 800, letterSpacing: "0.07em",
            border: `1px solid ${activeProviders.includes(p) ? PROVIDER_META[p].dot : "var(--border)"}`,
            background: activeProviders.includes(p) ? `${PROVIDER_META[p].dot}22` : "var(--panel)",
            color: activeProviders.includes(p) ? PROVIDER_META[p].dot : "var(--muted)",
          }}>{PROVIDER_META[p].label}</button>
        ))}
      </div>
    </div>
  );
  const tierLensControlCard = (
    <div className="filter-control-card">
      <div className="filter-control-head">
        <span className="filter-control-label">TIER LENS</span>
        <span className="filter-control-note">{selectedTier || "All tiers"}</span>
      </div>
      <div className="filter-chip-row">
        {META.tiers.map(t => (
          <button key={t} className="hb" onClick={() => setSelectedTier(selectedTier === t ? null : t)} style={{
            padding: "5px 10px", borderRadius: 5, fontSize: 10, fontFamily: "inherit", fontWeight: 800,
            border: `1px solid ${selectedTier === t ? "var(--selected-border)" : "var(--border)"}`,
            background: selectedTier === t ? "var(--selected-bg)" : "var(--panel)",
            color: selectedTier === t ? "var(--selected-text)" : "var(--muted)",
          }}>{t}</button>
        ))}
      </div>
    </div>
  );
  const categoryControlCard = (
    <label className="filter-control-card" style={{ display: "grid", gap: 5 }}>
      <div className="filter-control-head" style={{ marginBottom: 0 }}>
        <span className="filter-control-label">CATEGORY</span>
        <span className="filter-control-note">{selectedCategory || "All categories"}</span>
      </div>
      <select
        className="filter-select"
        value={selectedCategory || ""}
        onChange={event => setSelectedCategory(event.target.value || null)}
      >
        <option value="">All categories ({CAPABILITIES.length} capabilities)</option>
        {CATEGORIES.map(cat => (
          <option key={cat} value={cat}>
            {cat} ({CAPABILITIES.filter(c => c.category === cat).length})
          </option>
        ))}
      </select>
    </label>
  );
  const densityControlCard = (
    <div className="filter-control-card">
      <div className="filter-control-head">
        <span className="filter-control-label">DENSITY</span>
        <span className="filter-control-note">{matrixDensity}</span>
      </div>
      <div className="filter-chip-row">
        {MATRIX_DENSITIES.map(value => (
          <button key={value} className="hb" onClick={() => setMatrixDensity(value)} style={{
            padding: "5px 10px", borderRadius: 5, fontSize: 10, fontFamily: "inherit", fontWeight: 800,
            border: `1px solid ${matrixDensity === value ? "var(--link)" : "var(--border)"}`,
            background: matrixDensity === value ? "var(--selected-bg)" : "var(--panel)",
            color: matrixDensity === value ? "var(--selected-text)" : "var(--muted)",
          }}>{value}</button>
        ))}
      </div>
    </div>
  );
  const overviewCards = [
    {
      id: "matrix",
      label: "Capability Matrix",
      iconKey: "layers",
      description: "Compare AWS, Azure, GCP, and OCI capability mappings with government availability and parity signals.",
      stat: `${CAPABILITIES.length} capabilities x ${PROVIDERS.length} providers`,
      onClick: () => setMode("matrix"),
    },
    {
      id: "patterns",
      label: "Architecture Patterns",
      iconKey: "blocks",
      description: "Planning overlays that group capability rows into common enterprise and regulated architecture starts.",
      stat: `${PATTERNS.length} patterns`,
      onClick: () => setMode("patterns"),
    },
    {
      id: "controls",
      label: "Compliance & Controls",
      iconKey: "shield-check",
      description: "Framework references and NIST SP 800-53 Rev. 5 family mappings tied back to capability rows.",
      stat: `${COMPLIANCE_FRAMEWORKS.length} frameworks | ${CONTROL_LENS.families.length} families`,
      onClick: () => setMode("controls"),
    },
    {
      id: "history",
      label: "Cloud Timeline",
      iconKey: "activity",
      description: "Milestones in each provider's commercial, free-tier, and government cloud journey.",
      stat: `${HISTORY.length} milestones`,
      onClick: () => setMode("history"),
    },
    {
      id: "provider-news",
      label: "Provider News",
      iconKey: "activity",
      description: "Official announced, preview, deprecated, and upcoming provider changes in four columns.",
      stat: `${UPCOMING.length} tracked items`,
      onClick: () => setMode("provider-news"),
    },
    {
      id: "status",
      label: "Operational Status",
      iconKey: "activity",
      description: "Official status pages and incident-history sources for cloud and adjacent platforms.",
      stat: `${STATUS_SOURCES.length} sources`,
      onClick: () => setMode("status"),
    },
    {
      id: "ai-watch",
      label: "AI Watch",
      iconKey: "brain-circuit",
      description: "Official release and documentation sources for frontier, open, and multimodal model labs.",
      stat: `${AI_WATCH_SOURCES.length} sources`,
      onClick: () => setMode("ai-watch"),
    },
    {
      id: "transparency",
      label: "AI Transparency",
      iconKey: "landmark",
      description: "State and DC public records for AI governance and transparency status.",
      stat: `${TRANSPARENCY.length} state/DC rows`,
      onClick: () => setMode("transparency"),
    },
  ];

  return (
    <div style={{ ...themeVars, colorScheme: theme, fontFamily: "'IBM Plex Sans', system-ui, sans-serif", background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; background: var(--panel-alt); }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
        .hb { transition: all 0.12s; cursor: pointer; }
        .hb:hover { opacity: 0.78; }
        a:hover { opacity: 0.8; }
        input::placeholder { color: var(--muted); opacity: 0.72; }
        input:focus, select:focus { outline: none; border-color: var(--link) !important; }
        .top-nav {
          display: flex;
          gap: 0;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
          overflow-x: visible;
        }
        .primary-filter-grid {
          display: grid;
          grid-template-columns: minmax(280px, 1.4fr) minmax(220px, .8fr) minmax(260px, 1fr);
          gap: 10px;
          align-items: stretch;
        }
        .primary-filter-grid.provider-only { grid-template-columns: minmax(280px, 560px); }
        .primary-filter-grid.matrix-primary {
          grid-template-columns: minmax(220px, 1.1fr) minmax(185px, .72fr) minmax(220px, .9fr) minmax(145px, .55fr) minmax(180px, .68fr);
        }
        .primary-filter-grid.matrix-primary.no-density {
          grid-template-columns: minmax(220px, 1.1fr) minmax(185px, .72fr) minmax(220px, .9fr) minmax(180px, .68fr);
        }
        .filter-control-card {
          padding: 9px 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel-alt);
          min-width: 0;
        }
        .filter-control-head {
          display: flex;
          gap: 10px;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 7px;
          flex-wrap: wrap;
        }
        .filter-control-label {
          font-size: 8px;
          color: var(--muted);
          letter-spacing: 0.1em;
          font-weight: 800;
        }
        .filter-control-note {
          font-size: 9px;
          color: var(--muted);
          font-weight: 700;
        }
        .filter-chip-row {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
        }
        .filter-select {
          width: 100%;
          min-width: 0;
          padding: 5px 8px;
          border-radius: 4px;
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text);
          font-size: 10px;
          font-family: inherit;
        }
        .filter-bar {
          position: sticky;
        }
        .matrix-filter-stack {
          display: grid;
          gap: 8px;
        }
        .matrix-control-row {
          display: grid;
          gap: 8px;
          align-items: stretch;
        }
        .matrix-control-row-primary {
          grid-template-columns: minmax(220px, .9fr) minmax(270px, 1.1fr) minmax(260px, .9fr) minmax(230px, .82fr);
        }
        .matrix-control-row-secondary {
          grid-template-columns: minmax(360px, 1.35fr) minmax(230px, .8fr) minmax(250px, .85fr) minmax(150px, .5fr) minmax(180px, .58fr);
        }
        .matrix-search-control,
        .matrix-control-group,
        .matrix-control-row .filter-control-card,
        .matrix-control-row .export-toolbar {
          min-width: 0;
          padding: 7px 8px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel-alt);
        }
        .matrix-search-control {
          display: grid;
          gap: 5px;
        }
        .matrix-control-row .filter-control-head {
          margin-bottom: 5px;
        }
        .matrix-control-row .filter-chip-row {
          gap: 5px;
        }
        .matrix-control-row .compact-export-toolbar {
          align-items: center !important;
          gap: 6px !important;
        }
        .matrix-control-row .compact-export-toolbar > div:first-child {
          flex: 1 1 auto;
        }
        .matrix-support-bars {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 8px;
          margin-bottom: 10px;
          align-items: start;
        }
        .collapsible-info {
          min-width: 0;
          align-self: start;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--panel);
          box-shadow: 0 1px 2px var(--shadow);
          overflow: hidden;
        }
        .collapsible-info-toggle {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(190px, max-content) minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          padding: 8px 10px;
          border: 0;
          background: var(--panel);
          color: inherit;
          text-align: left;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
        }
        .collapsible-info-summary {
          min-width: 0;
          color: var(--muted);
          font-family: 'IBM Plex Sans', system-ui, sans-serif;
          font-size: 10px;
          line-height: 1.45;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .collapsible-info-body {
          padding: 10px;
          border-top: 1px solid var(--border);
          background: var(--panel-alt);
        }
        .overview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 10px;
        }
        .overview-card {
          display: grid;
          gap: 10px;
          align-content: start;
          min-height: 150px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--panel);
          color: inherit;
          text-align: left;
          font-family: inherit;
          box-shadow: 0 1px 2px var(--shadow);
        }
        .overview-card-head {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text);
          font-size: 13px;
          font-weight: 900;
        }
        .overview-card-icon {
          width: 16px;
          height: 16px;
          background: var(--link);
          -webkit-mask-size: contain;
          mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-position: center;
          mask-position: center;
          flex-shrink: 0;
        }
        .overview-card-body {
          color: var(--ink2);
          font-size: 11px;
          line-height: 1.55;
        }
        .overview-card-stat {
          margin-top: auto;
          color: var(--link);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }
        .compact-export-toolbar {
          min-width: 0;
        }
        .compact-export-toolbar > div:first-child {
          min-width: 0;
          flex: 1 1 100%;
        }
        .matrix-lens-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(260px, .9fr);
          gap: 10px;
          align-items: stretch;
        }
        .matrix-lens-stack { display: grid; gap: 10px; }
        .filter-groups { display: grid; gap: 14px; }
        .filter-groups.with-context { grid-template-columns: minmax(420px, 1fr) minmax(280px, 370px); }
        .filter-context { padding-left: 16px; border-left: 1px solid var(--border); }
        @keyframes cimSlide {
          from { transform: translateX(24px); opacity: 0; }
          to { transform: none; opacity: 1; }
        }
        .design-matrix-shell { display: block; }
        .design-coverage-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
        }
        .design-coverage-card {
          width: 100%;
          padding: 14px 15px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--panel);
          box-shadow: 0 1px 2px var(--shadow);
          color: inherit;
          font-family: inherit;
          text-align: left;
          appearance: none;
        }
        .design-posture-counts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
        }
        .design-posture-counts div {
          min-width: 0;
          padding: 7px 8px;
          border-radius: 7px;
          border: 1px solid var(--border);
          background: var(--panel-alt);
        }
        .design-posture-counts strong {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          color: var(--text);
          line-height: 1.1;
        }
        .design-posture-counts span {
          display: block;
          margin-top: 3px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 8px;
          font-weight: 800;
          color: var(--faint);
          line-height: 1.35;
          text-transform: uppercase;
        }
        .design-coverage-detail {
          margin: 10px 0 10px;
          padding: 13px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--panel-alt);
          box-shadow: 0 1px 2px var(--shadow);
        }
        .design-evidence-columns {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px;
        }
        .design-evidence-list {
          display: grid;
          gap: 7px;
          max-height: 360px;
          overflow: auto;
          padding-right: 3px;
        }
        .design-evidence-row {
          padding: 10px 11px;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--panel);
          min-width: 0;
        }
        .design-read-key-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 18px;
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
          overflow: auto;
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
        .design-provider-cell-link {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          max-width: 100%;
          padding: 2px 6px;
          border: 1px solid var(--border);
          border-radius: 5px;
          background: var(--panel);
          color: var(--link);
          font-size: 9px;
          font-weight: 800;
          line-height: 1.25;
          text-decoration: none;
        }
        .global-news-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        .global-news-column {
          min-width: 0;
          padding: 10px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--panel-alt);
        }
        .global-news-item {
          min-width: 0;
          padding: 9px 10px;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--panel);
        }
        .global-news-item.compact {
          padding: 6px 7px;
          border-radius: 5px;
        }
        .global-news-panel.compact .global-news-column {
          padding: 8px;
        }
        .ai-watch-model-strip {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin: -2px 0 9px;
          padding: 7px 8px;
          border: 1px solid var(--border);
          border-radius: 5px;
          background: var(--panel-alt);
          color: var(--muted);
          font-size: 9px;
          line-height: 1.4;
        }
        .ai-watch-model-strip span {
          color: var(--link);
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 900;
          letter-spacing: 0.06em;
        }
        .ai-watch-model-strip strong {
          color: var(--ink2);
          font-weight: 700;
        }
        .ai-watch-model-chip-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin: 0 0 10px;
        }
        .ai-watch-model-chip {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 3px 7px;
          border: 1px solid var(--border);
          border-radius: 5px;
          background: var(--panel);
          color: var(--text);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 8.5px;
          font-weight: 800;
          line-height: 1.2;
        }
        .ai-watch-model-detail-list {
          display: grid;
          gap: 8px;
          margin: 0 0 11px;
        }
        .ai-watch-model-detail {
          min-width: 0;
          padding: 9px 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel);
        }
        .ai-watch-model-detail-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 5px;
        }
        .ai-watch-model-detail-head strong {
          color: var(--text);
          font-size: 11px;
          font-weight: 900;
          line-height: 1.25;
        }
        .ai-watch-model-detail-head span {
          color: var(--muted);
          font-family: 'IBM Plex Mono', monospace;
          font-size: 8px;
          font-weight: 800;
        }
        .ai-watch-model-best {
          color: var(--ink2);
          font-size: 10px;
          font-weight: 800;
          line-height: 1.45;
        }
        .ai-watch-model-source-note {
          margin-top: 5px;
          color: var(--muted);
          font-size: 9px;
          line-height: 1.45;
        }
        .ai-watch-model-links {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 7px;
        }
        .transparency-map-card {
          margin-bottom: 14px;
          padding: 13px 14px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--panel);
          box-shadow: 0 1px 2px var(--shadow);
        }
        .transparency-map-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .transparency-coverage-meter {
          min-width: 118px;
          padding: 9px 10px;
          border: 1px solid #15803d55;
          border-radius: 6px;
          background: #14532d12;
          text-align: center;
        }
        .transparency-coverage-meter strong {
          display: block;
          color: #16a34a;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 22px;
          line-height: 1;
        }
        .transparency-coverage-meter span {
          display: block;
          margin-top: 4px;
          color: var(--muted);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .transparency-map-scroll {
          overflow-x: auto;
          padding-bottom: 4px;
        }
        .transparency-map-grid {
          display: grid;
          grid-template-columns: repeat(12, 48px);
          grid-template-rows: repeat(7, 42px);
          gap: 5px;
          min-width: 631px;
          align-items: stretch;
        }
        .transparency-state-tile {
          display: grid;
          place-items: center;
          align-content: center;
          gap: 2px;
          min-width: 0;
          border: 1px solid;
          border-radius: 6px;
          text-decoration: none;
          transition: transform .12s, opacity .12s;
        }
        .transparency-state-tile:not(.disabled):hover {
          transform: translateY(-1px);
          opacity: .88;
        }
        .transparency-state-tile strong {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px;
          font-weight: 900;
          line-height: 1;
        }
        .transparency-state-tile span {
          max-width: 100%;
          padding: 0 2px;
          font-size: 7px;
          font-weight: 800;
          line-height: 1.15;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .transparency-state-tile.disabled {
          cursor: default;
        }
        .transparency-map-legend {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 10px;
        }
        .transparency-map-legend span {
          padding: 3px 7px;
          border: 1px solid;
          border-radius: 4px;
          font-size: 8px;
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 900;
        }
        .ai-focus-section-head {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .ai-focus-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(280px, 1fr));
          gap: 14px;
        }
        .ai-focus-card {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--panel);
          box-shadow: 0 1px 3px var(--shadow);
          overflow: hidden;
          min-width: 0;
        }
        .ai-focus-card-head {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 54px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--panel);
        }
        .ai-focus-card-head h3 {
          margin: 0;
          color: var(--text);
          font-size: 15px;
          font-weight: 900;
          line-height: 1.25;
        }
        .ai-focus-provider-list {
          display: grid;
        }
        .ai-focus-provider-row {
          display: grid;
          grid-template-columns: 32px minmax(0, 1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border2);
          color: var(--text);
        }
        .ai-focus-provider-row:last-child { border-bottom: none; }
        .ai-focus-provider-logo {
          width: 24px;
          height: 24px;
          border-radius: 7px;
          border: 1px solid var(--border);
          background-color: #fff;
          background-size: 16px;
          background-position: center;
          background-repeat: no-repeat;
        }
        .ai-focus-provider-service {
          min-width: 0;
          color: var(--ink2);
          font-size: 13px;
          font-weight: 500;
          line-height: 1.35;
        }
        .ai-focus-provider-badge {
          display: flex;
          justify-content: flex-end;
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
        .design-timeline-row {
          display: grid;
          grid-template-columns: 80px minmax(0, 1fr);
          gap: 16px;
          align-items: flex-start;
        }
        @media (max-width: 980px) {
          .design-detail-panel { position: static; max-height: none; }
          .design-secondary-card-head,
          .design-two-col { grid-template-columns: 1fr; }
          .design-provider-tile-grid { grid-template-columns: 1fr !important; }
          .design-read-key-grid { grid-template-columns: 1fr; }
          .primary-filter-grid,
          .primary-filter-grid.provider-only,
          .primary-filter-grid.matrix-primary,
          .primary-filter-grid.matrix-primary.no-density,
          .matrix-control-row-primary,
          .matrix-control-row-secondary,
          .matrix-support-bars,
          .collapsible-info-toggle,
          .matrix-lens-grid,
          .design-evidence-columns,
          .global-news-grid,
          .ai-focus-grid { grid-template-columns: 1fr; }
          .top-nav { gap: 6px; padding-bottom: 8px; }
          .top-nav-tab {
            flex: 1 1 calc(50% - 3px);
            min-width: 0;
            justify-content: center;
            border: 1px solid var(--border) !important;
            border-radius: 6px;
            margin-bottom: 0 !important;
            background: var(--panel-alt) !important;
            white-space: normal !important;
            text-align: center;
            padding: 8px 9px !important;
            font-size: 12px !important;
            line-height: 1.2;
          }
          .filter-groups.with-context { grid-template-columns: 1fr; }
          .filter-context { padding-left: 0; padding-top: 10px; border-left: none; border-top: 1px solid var(--border); }
          .filter-bar { position: static !important; }
        }
        @media (max-width: 620px) {
          .design-timeline-row { grid-template-columns: 58px minmax(0, 1fr); gap: 10px; }
          .ai-focus-provider-row {
            grid-template-columns: 28px minmax(0, 1fr);
            align-items: flex-start;
          }
          .ai-focus-provider-badge {
            grid-column: 2;
            justify-content: flex-start;
          }
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

      {/* HEADER */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "20px 28px 0", background: "var(--header-bg)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 6, background: "var(--text)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 4 }}>
              <div style={{ width: 11, height: 11, borderRadius: 2, border: "2px solid var(--bg)" }} />
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.15em", color: "var(--muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
                Regulated cloud capability intelligence
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", lineHeight: 1.15 }}>
                Cloud Provider Intelligence Matrix
              </div>
              <div style={{ fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.55, marginTop: 6, maxWidth: 620 }}>
                Which services are usable in each provider's government / sovereign cloud and how far commercial capabilities extend into regulated environments.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
            <button
              className="hb"
              onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", border: "1px solid var(--border)", background: "var(--panel)", color: "var(--text)", display: "flex", alignItems: "center", gap: 7, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: "50%", background: theme === "dark" ? "#fbbf24" : "#64748b" }} />
              {theme === "dark" ? "Dark" : "Light"}
            </button>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--faint)" }}>
              verified {META.last_verified}
            </div>
          </div>
        </div>

        <nav aria-label="View tabs" className="top-nav">
          {modes.map(m => (
            <button key={m.id} className="hb top-nav-tab" onClick={() => setMode(m.id)} title={m.desc} style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "11px 16px", border: "none",
              borderBottom: `2px solid ${mode === m.id ? "var(--text)" : "transparent"}`,
              marginBottom: -1,
              background: "transparent",
              color: mode === m.id ? "var(--text)" : "var(--muted)",
              fontSize: 13.5, fontWeight: 600, fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
              whiteSpace: "nowrap", cursor: "pointer", transition: "color .15s",
            }}>
              {m.iconKey && ICONS[m.iconKey] && (
                <span aria-hidden="true" style={{ display: "inline-block", width: 15, height: 15, background: mode === m.id ? "var(--text)" : "var(--muted)", WebkitMaskImage: `url(${ICONS[m.iconKey]})`, maskImage: `url(${ICONS[m.iconKey]})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", flexShrink: 0 }} />
              )}
              {m.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── FILTER BAR ── */}
      {mode !== "overview" && (
      <div className="filter-bar" style={{ top: 0, zIndex: 40, padding: "8px 24px 10px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
        <div style={{ display: "grid", gap: 10, marginBottom: mode === "matrix" ? 0 : 10 }}>
          {mode !== "matrix" && (
          <div style={{ width: "100%" }}>
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
          )}

          {showProviderControls && mode !== "matrix" && (
            <div className="primary-filter-grid provider-only">
              {providerControlCard}
            </div>
          )}
        </div>

        {mode === "matrix" && (
          <div className="matrix-filter-stack">
            <div className="matrix-control-row matrix-control-row-primary">
              <label className="matrix-search-control">
                <span className="filter-control-label">SEARCH</span>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search capability, service, provider, tag..."
                  style={{
                    width: "100%", padding: "7px 10px", borderRadius: 4,
                    border: "1px solid var(--border)", background: "var(--panel-alt)",
                    color: "var(--text)", fontSize: 10, fontFamily: "inherit",
                  }}
                />
              </label>
              <div className="matrix-control-group">
                <div className="filter-control-head">
                  <span className="filter-control-label">VIEW</span>
                  <span className="filter-control-note">{activeMatrixLens.note}</span>
                </div>
                <div className="filter-chip-row">
                  {MATRIX_LENSES.map(lens => {
                    const active = selectedMatrixLens === lens.id;
                    return (
                      <button key={lens.id} className="hb" onClick={() => { setSelectedMatrixLens(lens.id); setExpandedId(null); }} title={lens.note} style={{
                        padding: "4px 8px", borderRadius: 4, fontSize: 9, fontFamily: "inherit", fontWeight: 800,
                        border: `1px solid ${active ? "var(--link)" : "var(--border)"}`,
                        background: active ? "var(--selected-bg)" : "var(--panel)",
                        color: active ? "var(--selected-text)" : "var(--muted)",
                      }}>
                        {lens.label} ({matrixLensCounts[lens.id]})
                      </button>
                    );
                  })}
                </div>
              </div>
              {providerControlCard}
              {tierLensControlCard}
            </div>

            <div className="matrix-control-row matrix-control-row-secondary">
              <div className="matrix-control-group matrix-layer-control">
                <div className="filter-control-head">
                  <span className="filter-control-label">LAYER</span>
                  <span className="filter-control-note">{selectedLayer === DEFAULT_LAYER ? "All architecture layers" : selectedLayer}</span>
                </div>
                <div className="filter-chip-row">
                  <button className="hb" onClick={() => setSelectedLayer(DEFAULT_LAYER)} style={{
                    padding: "3px 8px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                    border: `1px solid ${selectedLayer === DEFAULT_LAYER ? "var(--link)" : "var(--border)"}`,
                    background: selectedLayer === DEFAULT_LAYER ? "var(--selected-bg)" : "var(--panel)",
                    color: selectedLayer === DEFAULT_LAYER ? "var(--selected-text)" : "var(--muted)",
                  }}>All ({filteredCaps.length})</button>
                  {DESIGN_LAYERS.map(layer => {
                    const count = filteredCaps.filter(c => CATEGORY_TO_LAYER[c.category] === layer.label).length;
                    const active = selectedLayer === layer.label;
                    const layerStyle = DESIGN_LAYER_STYLES[layer.label] || DESIGN_LAYER_STYLES["Operating Model"];
                    return (
                      <button key={layer.id} className="hb" onClick={() => setSelectedLayer(active ? DEFAULT_LAYER : layer.label)} style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                        border: `1px solid ${active ? layerStyle.color : "var(--border)"}`,
                        background: active ? layerStyle.bg : "var(--panel)",
                        color: active ? layerStyle.color : "var(--muted)",
                      }}>
                        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: layerStyle.color, flexShrink: 0 }} />
                        {layer.label} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="matrix-control-group">
                <div className="filter-control-head">
                  <span className="filter-control-label">AI</span>
                  <span className="filter-control-note">{selectedMatrixAiScope === DEFAULT_MATRIX_AI_SCOPE ? "All AI classes" : selectedMatrixAiScope}</span>
                </div>
                <div className="filter-chip-row">
                  {MATRIX_AI_FILTERS.map(scope => {
                    const active = selectedMatrixAiScope === scope;
                    const label =
                      scope === "AI_NATIVE" ? "AI-native" :
                      scope === "AI_CAPABLE" ? "AI-capable" :
                      scope === "STANDARD" ? "Standard" :
                      "All";
                    const count = scope === DEFAULT_MATRIX_AI_SCOPE ? filteredCaps.length : filteredCaps.filter(c => c.aiClassification === scope).length;
                    return (
                      <button key={scope} className="hb" onClick={() => setSelectedMatrixAiScope(scope)} style={{
                        padding: "3px 8px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                        border: `1px solid ${active ? "var(--link)" : "var(--border)"}`,
                        background: active ? "var(--selected-bg)" : "var(--panel)",
                        color: active ? "var(--selected-text)" : "var(--muted)",
                      }}>{label} ({count})</button>
                    );
                  })}
                </div>
              </div>
              {categoryControlCard}
              {showMatrixDensityControl && densityControlCard}
              <ExportToolbar exportData={exportData} compact />
            </div>
          </div>
        )}

        {mode !== "matrix" && showSecondaryFilterControls && (
          <div className={`filter-groups ${mode === "controls" || mode === "transparency" ? "with-context" : ""}`}>
            <div>
              {showTransparencyFilterControls ? (
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
              ) : showCategoryFilterControls ? (
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
              ) : null}
            </div>

            {mode === "controls" && (
              <div className="filter-context">
                <CollapsibleInfoBar
                  title="Compliance lens"
                  summary="Search filters frameworks and control families; category filters apply to linked NIST capabilities."
                  open={showControlsContext}
                  onToggle={() => setShowControlsContext(current => !current)}
                >
                  <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.55 }}>
                    Search filters frameworks and control families. Category filters apply to linked NIST capabilities only. Tier guidance is not applied in this view.
                  </div>
                </CollapsibleInfoBar>
              </div>
            )}

            {mode === "transparency" && (
              <div className="filter-context">
                <CollapsibleInfoBar
                  title="State AI transparency"
                  summary="Rows are official-source public records. Unknown means the state has not been populated yet."
                  open={showTransparencyContext}
                  onToggle={() => setShowTransparencyContext(current => !current)}
                >
                  <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.55 }}>
                    Rows are official-source public records. Unknown means the state has not been populated in this launch scaffold.
                  </div>
                </CollapsibleInfoBar>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* ── CONTENT ── */}
      <div style={{ padding: "14px 24px 40px", overflowX: "auto" }}>
        <div style={{ minWidth: `min(${contentMinWidthPx}px, 100%)` }}>
          {/* Search result count */}
          {mode !== "overview" && searchQuery.trim().length >= 2 && (
            <div style={{ marginBottom: 10, fontSize: 9, color: "var(--muted)" }}>
              {resultCount} result(s) for "{searchQuery}"
            </div>
          )}

          {mode === "overview" && <OverviewViewDesign cards={overviewCards} meta={META} />}

          {mode !== "matrix" && mode !== "overview" && <ExportToolbar exportData={exportData} />}

          {mode === "matrix" && selectedMatrixLens === "diff" && (
            <DiffViewDesign caps={filteredMatrixCaps} activeProviders={activeProviders} />
          )}

          {mode === "matrix" && selectedMatrixLens === "ai" && (
            <AIViewDesign
              caps={filteredMatrixCaps}
              activeProviders={activeProviders}
              selectedId={expandedId}
              setSelectedId={setExpandedId}
            />
          )}

          {mode === "matrix" && selectedMatrixLens !== "diff" && selectedMatrixLens !== "ai" && (
            <>
              <div className="matrix-support-bars">
                <CollapsibleInfoBar
                  title="How to read this matrix"
                  summary="Gov availability and parity are separate signals. Unknown means public official evidence has not established a stronger claim."
                  open={showMatrixReadKey}
                  onToggle={() => setShowMatrixReadKey(current => !current)}
                >
                  <MatrixReadKey onDismiss={() => setShowMatrixReadKey(false)} plain />
                </CollapsibleInfoBar>
                <CollapsibleInfoBar
                  title="About matrix evidence"
                  summary={matrixEvidenceSummary(filteredDesignRows, activeProviders)}
                  open={showMatrixEvidencePanel}
                  onToggle={() => setShowMatrixEvidencePanel(current => !current)}
                >
                  <MatrixCoverageStrip
                    rows={filteredDesignRows}
                    activeProviders={activeProviders}
                    onDismiss={() => setShowMatrixEvidencePanel(false)}
                  />
                </CollapsibleInfoBar>
              </div>
              <DesignMatrixView
                rows={filteredDesignRows}
                activeProviders={activeProviders}
                selectedId={expandedId}
                setSelectedId={setExpandedId}
                tier={selectedTier}
                density={matrixDensity}
              />
            </>
          )}

          {mode === "patterns" && <PatternViewDesign patterns={filteredPatterns} activeProviders={activeProviders} />}
          {mode === "controls" && <ControlLensViewDesign lens={CONTROL_LENS} families={filteredControlFamilies} frameworks={filteredComplianceFrameworks} />}
          {mode === "history" && <HistoryViewDesign items={filteredHistory} meta={HISTORY_META} activeProviders={activeProviders} />}
          {mode === "provider-news" && <ProviderNewsViewDesign items={filteredProviderNews} />}
          {mode === "status" && <StatusViewDesign sources={filteredStatusSources} meta={STATUS_META} />}
          {mode === "ai-watch" && <AiWatchViewDesign sources={filteredAiWatchSources} meta={AI_WATCH_META} />}
          {mode === "transparency" && <TransparencyViewDesign items={filteredTransparency} meta={TRANSPARENCY_META} />}
        </div>

        {/* Tag legend */}
        {mode !== "overview" && (
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
        )}
        {mode === "matrix" && selectedMatrixLens !== "diff" && expandedId && (
          <DesignMatrixDetail
            row={filteredDesignRows.find(row => row.cap === expandedId) || null}
            activeProviders={activeProviders}
            tier={selectedTier}
            onClose={() => setExpandedId(null)}
          />
        )}
      </div>
      </div>
      <PrintableExport exportData={exportData} />
    </div>
  );
}
