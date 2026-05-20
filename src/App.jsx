import { useState, useMemo, useEffect } from "react";
import matrixData   from "../data/matrix.json";
import upcomingData from "../data/upcoming.json";

const { capabilities: CAPABILITIES, categories: CATEGORIES, tags: TAG_DEFS, _meta: META } = matrixData;
const UPCOMING = upcomingData.upcoming || [];
const PROVIDERS = META.providers; // ["aws","azure","gcp"]

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
  },
};

function getSystemTheme() {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Ignore storage access errors and fall back to the system preference.
  }
  return getSystemTheme();
}

const PROVIDER_META = {
  aws:   { label: "AWS",   long: "Amazon Web Services",  dot: "#ff9900", bg: "#ff990011", border: "#ff990033" },
  azure: { label: "Azure", long: "Microsoft Azure",      dot: "#00b4d8", bg: "#00b4d811", border: "#00b4d833" },
  gcp:   { label: "GCP",   long: "Google Cloud",         dot: "#4285f4", bg: "#4285f411", border: "#4285f433" },
};

const GOV_AVAIL_STYLES = {
  "Full":        { bg: "#14532d", fg: "#4ade80", label: "GOV FULL" },
  "Partial":     { bg: "#78350f", fg: "#fbbf24", label: "GOV PARTIAL" },
  "Limited":     { bg: "#7c2d12", fg: "#fb923c", label: "GOV LIMITED" },
  "None":        { bg: "#1f2937", fg: "#6b7280", label: "GOV NONE" },
};

const PARITY_STYLES = {
  "None":        { bg: "transparent", fg: "#374151", label: "" },
  "Minor":       { bg: "#78350f22", fg: "#f59e0b", label: "LAG MINOR" },
  "Moderate":    { bg: "#7f1d1d22", fg: "#f87171", label: "LAG MODERATE" },
  "Significant": { bg: "#7f1d1d44", fg: "#ef4444", label: "LAG SIGNIFICANT" },
};

const TAG_STYLES = {
  gray:   { bg: "#1f2937", fg: "#9ca3af", border: "#374151" },
  blue:   { bg: "#1e3a5f", fg: "#60a5fa", border: "#1d4ed8" },
  purple: { bg: "#2e1065", fg: "#c084fc", border: "#7c3aed" },
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

function TagBadge({ tagKey }) {
  const def = TAG_DEFS[tagKey];
  if (!def) return null;
  const s = TAG_STYLES[def.color] || TAG_STYLES.gray;
  return (
    <span title={def.description} style={{
      fontSize: 8, padding: "2px 7px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.07em",
      background: s.bg, color: s.fg, border: `1px solid ${s.border}`,
      cursor: "help", whiteSpace: "nowrap",
    }}>{def.label}</span>
  );
}

function GovBadge({ avail }) {
  const s = GOV_AVAIL_STYLES[avail] || GOV_AVAIL_STYLES["None"];
  if (avail === "None") return null;
  return (
    <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, fontWeight: 700, letterSpacing: "0.06em", background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function ParityBadge({ parity }) {
  if (!parity || parity === "None") return null;
  const s = PARITY_STYLES[parity] || PARITY_STYLES["Minor"];
  return (
    <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, fontWeight: 700, letterSpacing: "0.06em", background: s.bg, color: s.fg, border: `1px solid ${s.fg}33`, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function VerifiedStamp({ date }) {
  return (
    <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.06em" }}>
      ✓ VERIFIED {date}
    </span>
  );
}

// ── CAPABILITY ROW ─────────────────────────────────────────────────────────
function CapabilityRow({ cap, activeProviders, expandedId, setExpandedId, tier }) {
  const isExpanded = expandedId === cap.capability;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Main row */}
      <div style={{ display: "grid", gridTemplateColumns: `220px ${activeProviders.map(() => "1fr").join(" ")}`, gap: 8 }}>
        {/* Capability label */}
        <div
          onClick={() => setExpandedId(isExpanded ? null : cap.capability)}
          style={{ padding: "10px 12px", borderRadius: 4, border: `1px solid ${isExpanded ? "var(--link)" : "var(--border)"}`, background: isExpanded ? "var(--panel-alt)" : "var(--panel)", cursor: "pointer", minHeight: 80 }}
        >
          <div style={{ fontSize: 8, color: "var(--link)", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 700 }}>{cap.category.toUpperCase()}</div>
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
              style={{ padding: "10px 14px", borderRadius: 4, border: `1px solid ${isExpanded ? pm.border : "var(--border)"}`, background: isExpanded ? pm.bg : "var(--panel)", cursor: "pointer", minHeight: 80 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, flex: 1 }}>{prov.service}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <GovBadge avail={prov.govAvailability} />
                <ParityBadge parity={prov.parityLag} />
              </div>
              {tier && prov.tierNotes?.[tier] && (
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 5, lineHeight: 1.4 }}>{prov.tierNotes[tier]}</div>
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

// ── UPCOMING BANNER ────────────────────────────────────────────────────────
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
  const [mode, setMode] = useState("matrix");   // matrix | diff | gov | ai
  const [activeProviders, setActiveProviders] = useState([...PROVIDERS]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [selectedTier, setSelectedTier] = useState("Enterprise");
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
        Object.values(c.providers).some(p => p.service?.toLowerCase().includes(q))
      );
    }
    return caps;
  }, [selectedCategory, searchQuery]);

  const govAlertCount = CAPABILITIES.filter(c =>
    Object.values(c.providers).some(p => p.govAvailability !== "Full" || (p.parityLag && p.parityLag !== "None"))
  ).length;

  const modes = [
    { id: "matrix", label: "MATRIX", desc: "All capabilities by tier" },
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
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px 0", background: "var(--header-bg)" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--link)", marginBottom: 3, fontWeight: 700 }}>
              ENTERPRISE CLOUD CAPABILITY INTELLIGENCE
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              AWS · Azure · GCP
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
              {CAPABILITIES.length} capabilities · {CATEGORIES.length} categories · fact-first · official sources only
            </div>
          </div>

          {/* Search */}
          <div style={{ marginLeft: 20, flex: 1, maxWidth: 360 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search capability, service, tag, compliance term..."
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
              <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.06em" }}>GOV GAPS</div>
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
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
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
      <div style={{ padding: "8px 24px", borderBottom: "1px solid var(--border)", background: "var(--panel)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", marginRight: 2 }}>CATEGORY</span>
        <button className="hb" onClick={() => setSelectedCategory(null)} style={{
          padding: "2px 10px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
          border: `1px solid ${!selectedCategory ? "var(--link)" : "var(--border)"}`,
          background: !selectedCategory ? "#1e3a5f" : "transparent",
          color: !selectedCategory ? "#93c5fd" : "var(--muted)",
        }}>ALL ({CAPABILITIES.length})</button>
        {CATEGORIES.map(cat => {
          const count = CAPABILITIES.filter(c => c.category === cat).length;
          return (
            <button key={cat} className="hb" onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)} style={{
              padding: "2px 10px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
              border: `1px solid ${selectedCategory === cat ? "var(--link)" : "var(--border)"}`,
              background: selectedCategory === cat ? "#1e3a5f" : "transparent",
              color: selectedCategory === cat ? "#93c5fd" : "var(--muted)",
            }}>{cat} ({count})</button>
          );
        })}

        {/* Tier selector (only relevant for matrix mode) */}
        {mode === "matrix" && (
          <>
            <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", marginLeft: 12 }}>TIER</span>
            {META.tiers.map(t => (
              <button key={t} className="hb" onClick={() => setSelectedTier(selectedTier === t ? null : t)} style={{
                padding: "2px 10px", borderRadius: 3, fontSize: 9, fontFamily: "inherit",
                border: `1px solid ${selectedTier === t ? "#a78bfa" : "var(--border)"}`,
                background: selectedTier === t ? "#4c1d9533" : "transparent",
                color: selectedTier === t ? "#a78bfa" : "var(--muted)",
              }}>{t}</button>
            ))}
          </>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "14px 24px 40px", overflowX: "auto" }}>
        <div style={{ minWidth: 780 }}>
          <UpcomingBanner items={UPCOMING} />

          {/* Search result count */}
          {searchQuery.trim().length >= 2 && (
            <div style={{ marginBottom: 10, fontSize: 9, color: "var(--muted)" }}>
              {filteredCaps.length} result(s) for "{searchQuery}"
            </div>
          )}

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
              {filteredCaps.map(cap => (
                <CapabilityRow key={cap.capability} cap={cap} activeProviders={activeProviders} expandedId={expandedId} setExpandedId={setExpandedId} tier={selectedTier} />
              ))}
            </div>
          )}

          {mode === "diff" && <DiffView caps={filteredCaps} activeProviders={activeProviders} />}
          {mode === "gov"  && <GovView  caps={filteredCaps} activeProviders={activeProviders} />}
          {mode === "ai"   && <AIView   caps={filteredCaps} activeProviders={activeProviders} />}
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
          <div style={{ marginTop: 10, fontSize: 8, color: "var(--muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>Data: official provider documentation only</span>
            <span>Last verified: {META.last_verified}</span>
            <span>v{META.version}</span>
            <a href="https://github.com/MW8-ai/CloudIntelMatrix" target="_blank" rel="noopener noreferrer" style={{ color: "var(--link)" }}>↗ GitHub</a>
            <a href="https://github.com/MW8-ai/CloudIntelMatrix/issues/new/choose" target="_blank" rel="noopener noreferrer" style={{ color: "var(--link)" }}>↗ Report correction</a>
          </div>
        </div>
      </div>
    </div>
  );
}
