import { Fragment, useState, useMemo, useEffect } from "react";
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

const THEME_STORAGE_KEY = "cloudintel-theme";

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
          <div style={{ display: "inline-flex", maxWidth: "100%", padding: "2px 6px", borderRadius: 3, border: "1px solid var(--border)", background: "var(--category-bg)", color: "var(--category-text)", fontSize: 8, letterSpacing: "0.08em", marginBottom: 6, fontWeight: 700 }}>{cap.category.toUpperCase()}</div>
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

// ── GOV FOCUS VIEW ─────────────────────────────────────────────────────────
function GovView({ caps, activeProviders }) {
  return (
    <div>
      <div style={{ padding: "10px 0 16px", fontSize: 9, color: "var(--muted)", letterSpacing: "0.04em" }}>
        Showing government availability, parity lag, and gov-variant names across all capabilities. Rows with PARITY_LAG or GOV_LIMITED tags are elevated.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 8, marginBottom: 8 }}>
        <div style={{ padding: "7px 12px", borderRadius: 4, background: "var(--panel-alt)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)" }}>CAPABILITY</div>
        </div>
        {activeProviders.map(p => (
          <div key={p} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${PROVIDER_META[p].border}`, background: PROVIDER_META[p].bg, textAlign: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: PROVIDER_META[p].dot }}>{PROVIDER_META[p].label}</span>
          </div>
        ))}
      </div>
      {caps.map((cap, ci) => (
        <div key={cap.capability} style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 8, marginBottom: 6 }}>
          <div style={{ padding: "8px 12px", borderRadius: 4, border: "1px solid var(--border)", background: ci % 2 === 0 ? "var(--panel)" : "var(--panel-alt)" }}>
            <div style={{ fontSize: 8, color: "var(--link)", letterSpacing: "0.08em" }}>{cap.category}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{cap.capability}</div>
            <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
              {cap.tags.filter(t => ["GOV_AVAILABLE","GOV_LIMITED","PARITY_LAG","COMPLIANCE_RELEVANT"].includes(t)).map(t => (
                <TagBadge key={t} tagKey={t} />
              ))}
            </div>
          </div>
          {activeProviders.map(provKey => {
            const prov = cap.providers[provKey];
            const pm = PROVIDER_META[provKey];
            if (!prov) return <div key={provKey} style={{ background: "var(--panel)", borderRadius: 4, border: "1px solid var(--border)" }} />;
            const hasIssue = prov.govAvailability !== "Full" || (prov.parityLag && prov.parityLag !== "None");
            return (
              <div key={provKey} style={{ padding: "8px 12px", borderRadius: 4, border: `1px solid ${hasIssue ? pm.border : "var(--border)"}`, background: hasIssue ? pm.bg : ci % 2 === 0 ? "var(--panel)" : "var(--panel-alt)" }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
                  <GovBadge avail={prov.govAvailability} />
                  <ParityBadge parity={prov.parityLag} />
                </div>
                <div style={{ fontSize: 9, color: "var(--muted)" }}>{prov.govVariant || "—"}</div>
                {prov.govDocsUrl && <a href={prov.govDocsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 8, color: "#4ade80", textDecoration: "none", display: "block", marginTop: 3 }}>↗ Gov docs</a>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── AI FOCUS VIEW ──────────────────────────────────────────────────────────
function AIView({ caps, activeProviders }) {
  const aiCaps = caps.filter(c => c.tags.some(t => ["AI_NATIVE","AI_CAPABLE"].includes(t)));
  return (
    <div>
      <div style={{ padding: "10px 0 16px", fontSize: 9, color: "var(--muted)" }}>
        Filtered to AI_NATIVE and AI_CAPABLE capabilities. Classification follows: STANDARD = traditional infra, AI_CAPABLE = supports AI workloads, AI_NATIVE = purpose-built AI/ML.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 8, marginBottom: 8 }}>
        <div style={{ padding: "7px 12px", borderRadius: 4, background: "var(--panel-alt)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)" }}>CAPABILITY</div>
        </div>
        {activeProviders.map(p => (
          <div key={p} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${PROVIDER_META[p].border}`, background: PROVIDER_META[p].bg, textAlign: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: PROVIDER_META[p].dot }}>{PROVIDER_META[p].label}</span>
          </div>
        ))}
      </div>
      {aiCaps.map((cap, ci) => {
        const aiClass = cap.tags.find(t => ["AI_NATIVE","AI_CAPABLE"].includes(t));
        return (
          <div key={cap.capability} style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 8, marginBottom: 6 }}>
            <div style={{ padding: "8px 12px", borderRadius: 4, border: "1px solid var(--border)", background: ci % 2 === 0 ? "var(--panel)" : "var(--panel-alt)" }}>
              <div style={{ fontSize: 8, color: "var(--link)", letterSpacing: "0.08em" }}>{cap.category}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{cap.capability}</div>
              <div style={{ marginTop: 4 }}><TagBadge tagKey={aiClass} /></div>
            </div>
            {activeProviders.map(provKey => {
              const prov = cap.providers[provKey];
              const pm = PROVIDER_META[provKey];
              if (!prov) return <div key={provKey} style={{ background: "var(--panel)", borderRadius: 4, border: "1px solid var(--border)" }} />;
              return (
                <div key={provKey} style={{ padding: "8px 12px", borderRadius: 4, border: `1px solid ${pm.border}`, background: pm.bg }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{prov.service}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <GovBadge avail={prov.govAvailability} />
                    <ParityBadge parity={prov.parityLag} />
                  </div>
                  {prov.docsUrl && <a href={prov.docsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 8, color: "var(--link)", textDecoration: "none", display: "block", marginTop: 5 }}>↗ Docs</a>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── DIFF VIEW ──────────────────────────────────────────────────────────────
function DiffView({ caps, activeProviders }) {
  return (
    <div>
      <div style={{ padding: "10px 0 16px", fontSize: 9, color: "var(--muted)" }}>
        Side-by-side service equivalency. Equivalent services performing the same function mapped per capability.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 8, marginBottom: 8 }}>
        <div style={{ padding: "7px 12px", borderRadius: 4, background: "var(--panel-alt)", border: "1px solid var(--border)" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)" }}>CAPABILITY</span>
        </div>
        {activeProviders.map(p => (
          <div key={p} style={{ padding: "7px 12px", borderRadius: 4, border: `1px solid ${PROVIDER_META[p].border}`, background: PROVIDER_META[p].bg, textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: PROVIDER_META[p].dot }}>{PROVIDER_META[p].label}</div>
            <div style={{ fontSize: 8, color: "var(--muted)" }}>{PROVIDER_META[p].long.toUpperCase()}</div>
          </div>
        ))}
      </div>
      {caps.map((cap, ci) => (
        <div key={cap.capability} style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 8, marginBottom: 7 }}>
          <div style={{ padding: "10px 12px", borderRadius: 4, border: "1px solid var(--border)", background: ci % 2 === 0 ? "var(--panel)" : "var(--panel-alt)" }}>
            <div style={{ fontSize: 8, color: "var(--link)", letterSpacing: "0.08em" }}>{cap.category}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{cap.capability}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
              {cap.tags.slice(0,3).map(t => <TagBadge key={t} tagKey={t} />)}
            </div>
          </div>
          {activeProviders.map(provKey => {
            const prov = cap.providers[provKey];
            const pm = PROVIDER_META[provKey];
            if (!prov) return <div key={provKey} style={{ background: "var(--panel)", borderRadius: 4, border: "1px solid var(--border)" }} />;
            return (
              <div key={provKey} style={{ padding: "10px 14px", borderRadius: 4, border: `1px solid ${pm.border}`, background: pm.bg }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: pm.dot, marginBottom: 5 }}>{prov.service}</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  <GovBadge avail={prov.govAvailability} />
                  <ParityBadge parity={prov.parityLag} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── ARCHITECTURE PATTERN VIEW ──────────────────────────────────────────────
function PatternView({ patterns, activeProviders }) {
  const [expandedPatternId, setExpandedPatternId] = useState(patterns[0]?.id || null);

  if (!patterns.length) {
    return <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No architecture patterns match the current filter.</div>;
  }

  return (
    <div>
      <div style={{ padding: "10px 0 14px", fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>
        Curated enterprise starting points derived from provider-authored architecture-framework and foundation guidance. These overlays organize review decisions; they are not compliance approval or claims of product equivalence.
      </div>
      <div style={{ padding: "10px 12px", marginBottom: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>OFFICIAL FRAMEWORK BASIS</div>
        <div style={{ display: "grid", gridTemplateColumns: activeProviders.map(() => "1fr").join(" "), gap: 12 }}>
          {activeProviders.map(provKey => {
            const guidance = FRAMEWORKS[provKey];
            const pm = PROVIDER_META[provKey];
            return (
              <div key={provKey} style={{ borderLeft: `2px solid ${pm.dot}`, paddingLeft: 10, minHeight: 54 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: pm.dot, marginBottom: 4 }}>{pm.label}</div>
                <a href={guidance.frameworkUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 9, color: "var(--link)", textDecoration: "none", marginBottom: 3 }}>
                  {guidance.framework}
                </a>
                <a href={guidance.foundationUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 9, color: "var(--link)", textDecoration: "none" }}>
                  {guidance.foundation}
                </a>
              </div>
            );
          })}
        </div>
      </div>
      {patterns.map(pattern => {
        const isExpanded = expandedPatternId === pattern.id;
        const linkedCaps = pattern.capabilities.map(name => CAPABILITY_MAP[name]).filter(Boolean);
        return (
          <div key={pattern.id} style={{ marginBottom: 10, border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)", overflow: "hidden" }}>
            <button
              className="hb"
              onClick={() => setExpandedPatternId(isExpanded ? null : pattern.id)}
              aria-expanded={isExpanded}
              style={{
                width: "100%", textAlign: "left", padding: "12px 14px", border: "none",
                background: isExpanded ? "var(--panel-alt)" : "var(--panel)", color: "var(--text)",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 5 }}>{pattern.name}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.55, maxWidth: 900 }}>{pattern.summary}</div>
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--link)" }}>{isExpanded ? "COLLAPSE" : "EXPAND"}</div>
                  <VerifiedStamp date={pattern.lastVerified} />
                </div>
              </div>
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 8, lineHeight: 1.5 }}>
                <span style={{ color: "var(--link)", fontWeight: 700 }}>FIT: </span>{pattern.whenToUse}
              </div>
            </button>
            {isExpanded && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px 14px" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, marginBottom: 7 }}>DECISION MAP</div>
                <div style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 6, marginBottom: 14 }}>
                  <div style={{ padding: "6px 8px", background: "var(--panel-alt)", border: "1px solid var(--border)", fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>CAPABILITY</div>
                  {activeProviders.map(provKey => (
                    <div key={provKey} style={{ padding: "6px 8px", background: PROVIDER_META[provKey].bg, border: `1px solid ${PROVIDER_META[provKey].border}`, fontSize: 9, color: PROVIDER_META[provKey].dot, fontWeight: 700 }}>
                      {PROVIDER_META[provKey].label}
                    </div>
                  ))}
                  {linkedCaps.flatMap(cap => [
                    <div key={`${cap.capability}-label`} style={{ padding: "7px 8px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 9, color: "var(--link)" }}>{cap.category}</div>
                      <div style={{ fontSize: 10, color: "var(--text)", fontWeight: 600, lineHeight: 1.4 }}>{cap.capability}</div>
                    </div>,
                    ...activeProviders.map(provKey => {
                      const provider = cap.providers[provKey];
                      return (
                        <div key={`${cap.capability}-${provKey}`} style={{ padding: "7px 8px", borderBottom: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.4, marginBottom: 4 }}>{provider.service}</div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <GovBadge avail={provider.govAvailability} />
                            <ParityBadge parity={provider.parityLag} />
                          </div>
                        </div>
                      );
                    }),
                  ])}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>REVIEW QUESTIONS</div>
                    {pattern.reviewPrompts.map(prompt => (
                      <div key={prompt} style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.5, marginBottom: 6, paddingLeft: 10, borderLeft: "2px solid var(--border)" }}>{prompt}</div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>VERIFICATION BOUNDARY</div>
                    <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.65 }}>{pattern.verificationNote}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// -- COMPLIANCE LENS -------------------------------------------------------
function ControlLensView({ lens, families, frameworks }) {
  const groupedFrameworks = Object.entries(COMPLIANCE_KIND_LABELS)
    .map(([kind, label]) => ({
      kind,
      label,
      items: frameworks.filter(framework => framework.kind === kind),
    }))
    .filter(group => group.items.length);

  return (
    <div>
      <div style={{ padding: "12px 14px", margin: "10px 0 14px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--link)", fontWeight: 700, marginBottom: 4 }}>COMPLIANCE PLANNING LENS</div>
        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 700, marginBottom: 5 }}>Framework references plus {lens.name} - {lens.release}</div>
        <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6, marginBottom: 9 }}>{lens.scopeNote}</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <a href={lens.catalogUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>Official catalog</a>
          <a href={lens.baselineUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>Control baselines</a>
          <a href={lens.oscalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>OSCAL source</a>
          <VerifiedStamp date={lens.lastVerified} />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>FRAMEWORKS AND PROGRAMS</div>
        {!frameworks.length && (
          <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No compliance frameworks match the current search.</div>
        )}
        {groupedFrameworks.map(group => (
          <div key={group.kind} style={{ marginBottom: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)", overflow: "hidden" }}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "var(--panel-alt)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 10, color: "var(--text)", fontWeight: 700, letterSpacing: "0.08em" }}>{group.label.toUpperCase()}</div>
              <div style={{ fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>{group.items.length} item(s)</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(210px,1fr) 120px minmax(300px,1.5fr) minmax(260px,1.2fr) 120px", gap: 0, minWidth: 1010 }}>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>FRAMEWORK</div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>STATUS</div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>SCOPE</div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>NIST ALIGNMENT / NOTE</div>
              <div style={{ padding: "7px 10px", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>SOURCE</div>
              {group.items.map((framework, index) => {
                const bg = index % 2 === 0 ? "var(--panel)" : "var(--panel-alt)";
                return [
                  <div key={`${framework.id}-name`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg }}>
                    <div style={{ fontSize: 10, color: "var(--text)", fontWeight: 700, lineHeight: 1.45 }}>{framework.name}</div>
                    <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 4, lineHeight: 1.35 }}>{framework.issuer}</div>
                  </div>,
                  <div key={`${framework.id}-status`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg }}>
                    <ComplianceStatusBadge status={framework.status} />
                  </div>,
                  <div key={`${framework.id}-scope`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg, fontSize: 9, color: "var(--text)", lineHeight: 1.55 }}>
                    {framework.scope}
                  </div>,
                  <div key={`${framework.id}-alignment`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg, fontSize: 9, color: "var(--muted)", lineHeight: 1.55 }}>
                    <div>{Array.isArray(framework.nistAlignment) ? framework.nistAlignment.join("; ") : framework.nistAlignment}</div>
                    {framework.historicalNote && <div style={{ marginTop: 6, color: "var(--text)" }}>{framework.historicalNote}</div>}
                  </div>,
                  <div key={`${framework.id}-source`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg }}>
                    <a href={framework.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none", fontWeight: 700 }}>Official source</a>
                    <div style={{ marginTop: 6 }}><VerifiedStamp date={framework.lastVerified} /></div>
                  </div>,
                ];
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, margin: "16px 0 8px" }}>NIST SP 800-53 FAMILY LENS</div>
      {!families.length && (
        <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No control families match the current filter.</div>
      )}
      {families.map((family, index) => (
        <div key={family.id} style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, padding: "12px 14px", marginBottom: 8, border: "1px solid var(--border)", borderRadius: 6, background: index % 2 === 0 ? "var(--panel)" : "var(--panel-alt)" }}>
          <div>
            <div style={{ fontSize: 9, color: "var(--link)", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 5 }}>FAMILY {family.id}</div>
            <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 700, marginBottom: 6 }}>{family.name}</div>
            <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.55 }}>{family.applicability}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>IMPLEMENTATION TOUCHPOINTS</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 11 }}>
              {family.capabilities.map(capabilityName => (
                <span key={capabilityName} style={{ padding: "4px 7px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--panel)", color: "var(--text)", fontSize: 9 }}>
                  {capabilityName}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, marginBottom: 6 }}>ARCHITECTURE REVIEW QUESTIONS</div>
            {family.reviewPrompts.map(prompt => (
              <div key={prompt} style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.5, marginBottom: 5, paddingLeft: 9, borderLeft: "2px solid var(--border)" }}>{prompt}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// -- CLOUD HISTORY VIEW -------------------------------------------------------
function HistoryView({ items, meta, activeProviders }) {
  const years = Array.from(new Set(items.map(item => item.year))).sort((a, b) => a - b);
  const grouped = activeProviders
    .map(provider => ({
      provider,
      items: items
        .filter(item => item.provider === provider)
        .sort((a, b) => a.year - b.year || a.date.localeCompare(b.date)),
    }))
    .filter(group => group.items.length);

  if (!items.length) {
    return <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No history milestones match the current filter.</div>;
  }

  return (
    <div>
      <div style={{ padding: "12px 14px", margin: "10px 0 14px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--link)", fontWeight: 700, marginBottom: 4 }}>PROVIDER HISTORY LENS</div>
        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 700, marginBottom: 5 }}>Cloud, personal/free, and government timeline</div>
        <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6, marginBottom: 10 }}>{meta.scopeNote}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(HISTORY_PHASE_STYLES).map(([phase, style]) => (
            <span key={phase} style={{ fontSize: 8, padding: "3px 7px", borderRadius: 4, border: `1px solid ${style.border}`, background: style.bg, color: style.fg, fontWeight: 700, letterSpacing: "0.05em" }}>
              {phase.toUpperCase()}
            </span>
          ))}
          <VerifiedStamp date={meta.lastVerified} />
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: `135px repeat(${years.length}, minmax(92px, 1fr))`, borderBottom: "1px solid var(--border)" }}>
          <div style={{ padding: "8px 10px", background: "var(--panel-alt)", fontSize: 9, color: "var(--muted)", fontWeight: 700 }}>PROVIDER</div>
          {years.map(year => (
            <div key={year} style={{ padding: "8px 8px", background: "var(--panel-alt)", borderLeft: "1px solid var(--border)", fontSize: 9, color: "var(--muted)", fontWeight: 700, textAlign: "center" }}>{year}</div>
          ))}
        </div>
        {grouped.map((group, rowIndex) => {
          const pm = PROVIDER_META[group.provider];
          return (
            <div key={group.provider} style={{ display: "grid", gridTemplateColumns: `135px repeat(${years.length}, minmax(92px, 1fr))`, borderBottom: rowIndex === grouped.length - 1 ? "none" : "1px solid var(--border)" }}>
              <div style={{ padding: "10px", background: rowIndex % 2 === 0 ? "var(--panel)" : "var(--panel-alt)", borderRight: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: pm.dot }}>{pm.label}</div>
                <div style={{ fontSize: 8, color: "var(--muted)", lineHeight: 1.4 }}>{pm.long}</div>
              </div>
              {years.map(year => {
                const hits = group.items.filter(item => item.year === year);
                return (
                  <div key={`${group.provider}-${year}`} style={{ minHeight: 82, padding: 6, background: rowIndex % 2 === 0 ? "var(--panel)" : "var(--panel-alt)", borderLeft: "1px solid var(--border)" }}>
                    {hits.map(item => {
                      const phaseStyle = HISTORY_PHASE_STYLES[item.phase] || HISTORY_PHASE_STYLES["Commercial cloud"];
                      return (
                        <a key={item.id} href={item.sourceUrl} target="_blank" rel="noopener noreferrer" title={item.summary} style={{ display: "block", textDecoration: "none", padding: "6px 7px", borderRadius: 4, border: `1px solid ${phaseStyle.border}`, borderLeft: `3px solid ${pm.dot}`, background: phaseStyle.bg, marginBottom: 5 }}>
                          <div style={{ fontSize: 7, color: phaseStyle.fg, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 3 }}>{item.phase.toUpperCase()}</div>
                          <div style={{ fontSize: 9, color: "var(--text)", lineHeight: 1.35, fontWeight: 700 }}>{item.title}</div>
                          <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 3 }}>{item.dateLabel}</div>
                        </a>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
        {grouped.map(group => {
          const pm = PROVIDER_META[group.provider];
          return (
            <div key={`${group.provider}-detail`} style={{ border: `1px solid ${pm.border}`, borderRadius: 6, background: pm.bg, padding: "11px 12px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: pm.dot, marginBottom: 8 }}>{pm.label} milestones</div>
              {group.items.map(item => {
                const phaseStyle = HISTORY_PHASE_STYLES[item.phase] || HISTORY_PHASE_STYLES["Commercial cloud"];
                return (
                  <div key={`${item.id}-detail`} style={{ padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text)", lineHeight: 1.35 }}>{item.title}</span>
                      <span style={{ fontSize: 8, color: phaseStyle.fg, fontWeight: 700, whiteSpace: "nowrap" }}>{item.dateLabel}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.55, marginBottom: 5 }}>{item.summary}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                      {item.scope.map(scope => (
                        <span key={scope} style={{ fontSize: 7, padding: "2px 5px", borderRadius: 3, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--muted)", fontWeight: 700 }}>{scope}</span>
                      ))}
                      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 8, color: "var(--link)", textDecoration: "none", marginLeft: 4 }}>{item.sourceLabel}</a>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// -- STATE AI TRANSPARENCY VIEW --------------------------------------------
function TransparencyView({ items, meta }) {
  const federalContext = meta.federalContext || {};
  const counts = TRANSPARENCY_STATUS_ORDER
    .filter(status => status !== "All")
    .map(status => ({ status, count: items.filter(item => item.status === status).length }))
    .filter(item => item.count);

  return (
    <div>
      <div style={{ padding: "12px 14px", margin: "10px 0 14px", border: "1px solid #b45309", borderRadius: 6, background: "var(--panel)" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "#b45309", fontWeight: 700, marginBottom: 4 }}>POINT-IN-TIME STATE AI RECORD</div>
        <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 700, marginBottom: 5 }}>State AI governance and transparency mandates</div>
        <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.6, marginBottom: 8 }}>{meta.scopeNote}</div>
        <div style={{ fontSize: 10, color: "var(--text)", lineHeight: 1.6, marginBottom: 8 }}>
          Federal-state AI policy is volatile as of {meta.last_verified}. Context: {federalContext.citation} ({federalContext.title}).
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {federalContext.url && <a href={federalContext.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none" }}>Federal Register source</a>}
          <VerifiedStamp date={federalContext.lastVerified || meta.last_verified} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {counts.map(({ status, count }) => (
          <span key={status} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 7px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--panel)" }}>
            <TransparencyStatusBadge status={status} />
            <span style={{ fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>{count}</span>
          </span>
        ))}
      </div>

      {!items.length && (
        <div style={{ padding: "16px 0", fontSize: 10, color: "var(--muted)" }}>No state transparency rows match the current filters.</div>
      )}

      <div style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--panel)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 120px 170px minmax(210px,1fr) minmax(360px,1.5fr) 140px", minWidth: 1140 }}>
          <div style={{ padding: "8px 10px", background: "var(--panel-alt)", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>STATE</div>
          <div style={{ padding: "8px 10px", background: "var(--panel-alt)", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>STATUS</div>
          <div style={{ padding: "8px 10px", background: "var(--panel-alt)", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>INSTRUMENT</div>
          <div style={{ padding: "8px 10px", background: "var(--panel-alt)", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>TITLE / CITATION</div>
          <div style={{ padding: "8px 10px", background: "var(--panel-alt)", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>SUMMARY</div>
          <div style={{ padding: "8px 10px", background: "var(--panel-alt)", borderBottom: "1px solid var(--border)", fontSize: 8, color: "var(--muted)", fontWeight: 700 }}>SOURCE</div>
          {items.map((item, index) => {
            const bg = index % 2 === 0 ? "var(--panel)" : "var(--panel-alt)";
            return [
              <div key={`${item.state}-state`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg }}>
                <div style={{ fontSize: 11, color: "var(--text)", fontWeight: 700 }}>{item.stateName}</div>
                <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 3 }}>{item.state}</div>
              </div>,
              <div key={`${item.state}-status`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg }}>
                <TransparencyStatusBadge status={item.status} />
              </div>,
              <div key={`${item.state}-instrument`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg, fontSize: 9, color: "var(--text)", lineHeight: 1.45 }}>{item.instrument}</div>,
              <div key={`${item.state}-title`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg }}>
                <div style={{ fontSize: 10, color: "var(--text)", fontWeight: 700, lineHeight: 1.45 }}>{item.title}</div>
                {item.citation && <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 5, lineHeight: 1.45 }}>{item.citation}</div>}
              </div>,
              <div key={`${item.state}-summary`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg, fontSize: 9, color: "var(--text)", lineHeight: 1.55 }}>{item.summary}</div>,
              <div key={`${item.state}-source`} style={{ padding: "10px", borderBottom: "1px solid var(--border)", background: bg }}>
                {item.url ? (
                  <>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "var(--link)", textDecoration: "none", fontWeight: 700 }}>Official source</a>
                    <div style={{ marginTop: 6 }}><VerifiedStamp date={item.lastVerified} /></div>
                  </>
                ) : (
                  <VerifiedStamp date={item.lastVerified} />
                )}
              </div>,
            ];
          })}
        </div>
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
  const [mode, setMode] = useState("matrix");   // matrix | patterns | controls | history | diff | gov | ai
  const [activeProviders, setActiveProviders] = useState([...PROVIDERS]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [selectedTier, setSelectedTier] = useState("Enterprise");
  const [selectedTransparencyStatus, setSelectedTransparencyStatus] = useState("All");
  const themeVars = THEME_TOKENS[theme];

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Theme switching should still work when storage is unavailable.
    }
  }, [theme]);

  const toggleProvider = p =>
    setActiveProviders(prev => prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p]);

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
        @media (max-width: 980px) {
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

          {/* Search */}
          <div style={{ marginLeft: 20, flex: 1, maxWidth: 360 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search capability, pattern, state, service, tag..."
              style={{
                width: "100%", padding: "7px 12px", borderRadius: 4,
                border: "1px solid var(--border)", background: "var(--panel)",
                color: "var(--text)", fontSize: 10, fontFamily: "inherit",
              }}
            />
          </div>

          {/* Stats strip */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" }}>
            <button
              className="hb"
              onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")}
              style={{
                padding: "6px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                border: "1px solid var(--border)", background: "var(--panel)",
                color: "var(--text)", fontFamily: "inherit", whiteSpace: "nowrap",
              }}
            >
              Theme: {theme === "dark" ? "Dark" : "Light"}
            </button>
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
          {/* Provider toggles pushed right */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", paddingBottom: 8 }}>
            {PROVIDERS.map(p => (
              <button key={p} className="hb" onClick={() => toggleProvider(p)} style={{
                padding: "3px 12px", borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: "0.07em",
                border: `1px solid ${activeProviders.includes(p) ? PROVIDER_META[p].dot : "var(--border)"}`,
                background: activeProviders.includes(p) ? `${PROVIDER_META[p].dot}22` : "transparent",
                color: activeProviders.includes(p) ? PROVIDER_META[p].dot : "var(--muted)",
              }}>{PROVIDER_META[p].label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <div style={{ padding: "10px 24px 12px", borderBottom: "1px solid var(--border)", background: "var(--panel)" }}>
        <div className={`filter-groups ${mode === "matrix" || mode === "controls" || mode === "transparency" ? "with-context" : ""}`}>
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
                        padding: "3px 10px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                        border: `1px solid ${selectedCategory === cat ? "var(--link)" : "var(--border)"}`,
                        background: selectedCategory === cat ? "var(--selected-bg)" : "transparent",
                        color: selectedCategory === cat ? "var(--selected-text)" : "var(--muted)",
                      }}>{cat} ({count})</button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Tier selector (only relevant for matrix mode) */}
          {mode === "matrix" && (
            <div className="filter-context">
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", fontWeight: 700 }}>TIER GUIDANCE</span>
                <span style={{ fontSize: 9, color: "var(--text)", fontWeight: 600 }}>
                  Showing: {selectedTier || "All tiers"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {META.tiers.map(t => (
                  <button key={t} className="hb" onClick={() => setSelectedTier(selectedTier === t ? null : t)} style={{
                    padding: "3px 10px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                    border: `1px solid ${selectedTier === t ? "var(--selected-border)" : "var(--border)"}`,
                    background: selectedTier === t ? "var(--selected-bg)" : "transparent",
                    color: selectedTier === t ? "var(--selected-text)" : "var(--muted)",
                  }}>{t}</button>
                ))}
              </div>
            </div>
          )}

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
        <div style={{ minWidth: mode === "history" || mode === "controls" || mode === "transparency" ? 1080 : activeProviders.length > 3 ? 1040 : 780 }}>
          <UpcomingBanner items={UPCOMING} />

          {/* Search result count */}
          {searchQuery.trim().length >= 2 && (
            <div style={{ marginBottom: 10, fontSize: 9, color: "var(--muted)" }}>
              {resultCount} result(s) for "{searchQuery}"
            </div>
          )}

          <ExportToolbar exportData={exportData} />

          {mode === "matrix" && (
            <div>
              {/* Provider header */}
              <div style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 8, marginBottom: 8 }}>
                <div style={{ padding: "8px 12px", borderRadius: 4, background: "var(--panel-alt)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)" }}>CAPABILITY</div>
                  {selectedTier && <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 2 }}>Tier: {selectedTier}</div>}
                </div>
                {activeProviders.map(p => (
                  <div key={p} style={{ padding: "8px 14px", borderRadius: 4, border: `1px solid ${PROVIDER_META[p].border}`, background: PROVIDER_META[p].bg, textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: PROVIDER_META[p].dot, letterSpacing: "0.1em" }}>{PROVIDER_META[p].label}</div>
                    <div style={{ fontSize: 8, color: "var(--muted)", marginTop: 1 }}>{PROVIDER_META[p].long.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              {filteredCaps.map((cap, index) => {
                const startsCategory = index === 0 || filteredCaps[index - 1]?.category !== cap.category;
                const categoryCount = startsCategory ? filteredCaps.filter(item => item.category === cap.category).length : 0;
                return (
                  <Fragment key={cap.capability}>
                    {startsCategory && (
                      <div style={{ margin: index === 0 ? "0 0 8px" : "18px 0 8px", padding: "7px 10px", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "var(--category-bg)", color: "var(--category-text)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em" }}>{cap.category.toUpperCase()}</span>
                        <span style={{ fontSize: 9, color: "var(--muted)" }}>{categoryCount} capability row(s)</span>
                      </div>
                    )}
                    <CapabilityRow cap={cap} activeProviders={activeProviders} expandedId={expandedId} setExpandedId={setExpandedId} tier={selectedTier} />
                  </Fragment>
                );
              })}
            </div>
          )}

          {mode === "diff" && <DiffView caps={filteredCaps} activeProviders={activeProviders} />}
          {mode === "gov"  && <GovView  caps={filteredCaps} activeProviders={activeProviders} />}
          {mode === "ai"   && <AIView   caps={filteredAiCaps} activeProviders={activeProviders} />}
          {mode === "patterns" && <PatternView patterns={filteredPatterns} activeProviders={activeProviders} />}
          {mode === "controls" && <ControlLensView lens={CONTROL_LENS} families={filteredControlFamilies} frameworks={filteredComplianceFrameworks} />}
          {mode === "history" && <HistoryView items={filteredHistory} meta={HISTORY_META} activeProviders={activeProviders} />}
          {mode === "transparency" && <TransparencyView items={filteredTransparency} meta={TRANSPARENCY_META} />}
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
