import * as XLSX from "xlsx";

const PROVIDER_LABELS = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  oci: "OCI",
};

const MATRIX_COLUMNS = [
  "capability",
  "category",
  "tags",
  "aiClassification",
  "provider",
  "service",
  "status",
  "govAvailability",
  "parityLag",
  "govVariant",
  "docsUrl",
  "govDocsUrl",
  "complianceUrl",
  "pricingUrl",
  "lastVerified",
  "sourceNotes",
];

const PATTERN_COLUMNS = [
  "pattern",
  "summary",
  "whenToUse",
  "capability",
  "category",
  "provider",
  "service",
  "govAvailability",
  "parityLag",
  "providerFramework",
  "frameworkUrl",
  "providerFoundation",
  "foundationUrl",
  "reviewPrompts",
  "verificationNote",
  "lastVerified",
];

const COMPLIANCE_COLUMNS = [
  "rowType",
  "id",
  "name",
  "kind",
  "issuer",
  "status",
  "scope",
  "nistAlignment",
  "historicalNote",
  "officialUrl",
  "linkedCapabilities",
  "reviewPrompts",
  "lastVerified",
];

const HISTORY_COLUMNS = [
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
  "lastVerified",
];

const TRANSPARENCY_COLUMNS = [
  "state",
  "stateName",
  "instrument",
  "title",
  "citation",
  "status",
  "summary",
  "url",
  "lastVerified",
];

function asText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("; ");
  return String(value);
}

function joinNotes(parts) {
  return parts.map(asText).map(part => part.trim()).filter(Boolean).join(" ");
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function fileName(viewId, extension) {
  return `cloudintelmatrix-${viewId}-${todayStamp()}.${extension}`;
}

function sheetName(label) {
  return label.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Export";
}

function csvCell(value) {
  const text = asText(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowsToAoA(rows, columns) {
  return [
    columns,
    ...rows.map(row => columns.map(column => asText(row[column]))),
  ];
}

function autoWidths(rows, columns) {
  return columns.map(column => {
    const maxCell = rows.reduce((max, row) => Math.max(max, asText(row[column]).length), column.length);
    return { wch: Math.max(10, Math.min(64, maxCell + 2)) };
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildMatrixRows(caps, activeProviders, selectedTier = null) {
  return caps.flatMap(cap =>
    activeProviders.map(providerKey => {
      const provider = cap.providers?.[providerKey] || {};
      const tierNote = selectedTier && provider.tierNotes?.[selectedTier]
        ? `Tier guidance (${selectedTier}): ${provider.tierNotes[selectedTier]}`
        : "";
      return {
        capability: cap.capability,
        category: cap.category,
        tags: cap.tags || [],
        aiClassification: cap.aiClassification,
        provider: PROVIDER_LABELS[providerKey] || providerKey.toUpperCase(),
        service: provider.service,
        status: provider.status,
        govAvailability: provider.govAvailability,
        parityLag: provider.parityLag,
        govVariant: provider.govVariant,
        docsUrl: provider.docsUrl,
        govDocsUrl: provider.govDocsUrl,
        complianceUrl: provider.complianceUrl,
        pricingUrl: provider.pricingUrl,
        lastVerified: cap.lastVerified,
        sourceNotes: joinNotes([cap.sourceNotes, provider.sourceNotes, tierNote]),
      };
    })
  );
}

export function buildPatternRows(patterns, activeProviders, capabilityMap, frameworks) {
  return patterns.flatMap(pattern =>
    pattern.capabilities.flatMap(capabilityName => {
      const cap = capabilityMap[capabilityName];
      if (!cap) return [];
      return activeProviders.map(providerKey => {
        const provider = cap.providers?.[providerKey] || {};
        const framework = frameworks[providerKey] || {};
        return {
          pattern: pattern.name,
          summary: pattern.summary,
          whenToUse: pattern.whenToUse,
          capability: capabilityName,
          category: cap.category,
          provider: PROVIDER_LABELS[providerKey] || providerKey.toUpperCase(),
          service: provider.service,
          govAvailability: provider.govAvailability,
          parityLag: provider.parityLag,
          providerFramework: framework.framework,
          frameworkUrl: framework.frameworkUrl,
          providerFoundation: framework.foundation,
          foundationUrl: framework.foundationUrl,
          reviewPrompts: pattern.reviewPrompts || [],
          verificationNote: pattern.verificationNote,
          lastVerified: pattern.lastVerified,
        };
      });
    })
  );
}

export function buildComplianceRows(lens, families, frameworks = []) {
  return [
    ...frameworks.map(framework => ({
      rowType: "Framework",
      id: framework.id,
      name: framework.name,
      kind: framework.kind,
      issuer: framework.issuer,
      status: framework.status,
      scope: framework.scope,
      nistAlignment: framework.nistAlignment,
      historicalNote: framework.historicalNote,
      officialUrl: framework.url,
      linkedCapabilities: "",
      reviewPrompts: "",
      lastVerified: framework.lastVerified,
    })),
    ...families.map(family => ({
      rowType: "NIST control family",
      id: family.id,
      name: family.name,
      kind: lens.id,
      issuer: "NIST",
      status: lens.release,
      scope: family.applicability,
      nistAlignment: lens.scopeNote,
      historicalNote: "",
      officialUrl: lens.catalogUrl,
      linkedCapabilities: family.capabilities || [],
      reviewPrompts: family.reviewPrompts || [],
      lastVerified: lens.lastVerified,
    })),
  ];
}

export function buildHistoryRows(items, meta) {
  return items.map(item => ({
    provider: PROVIDER_LABELS[item.provider] || String(item.provider || "").toUpperCase(),
    phase: item.phase,
    year: item.year,
    date: item.date,
    dateLabel: item.dateLabel,
    title: item.title,
    summary: item.summary,
    scope: item.scope || [],
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl,
    lastVerified: meta.lastVerified,
  }));
}

export function buildTransparencyRows(items) {
  return items.map(item => ({
    state: item.state,
    stateName: item.stateName,
    instrument: item.instrument,
    title: item.title,
    citation: item.citation,
    status: item.status,
    summary: item.summary,
    url: item.url,
    lastVerified: item.lastVerified,
  }));
}

export function makeExportData(viewId, label, columns, rows) {
  return {
    viewId,
    label,
    columns,
    rows,
    generatedOn: todayStamp(),
  };
}

export function matrixExport(viewId, label, caps, activeProviders, selectedTier) {
  return makeExportData(viewId, label, MATRIX_COLUMNS, buildMatrixRows(caps, activeProviders, selectedTier));
}

export function patternExport(patterns, activeProviders, capabilityMap, frameworks) {
  return makeExportData("patterns", "Architecture Patterns", PATTERN_COLUMNS, buildPatternRows(patterns, activeProviders, capabilityMap, frameworks));
}

export function controlExport(lens, families, frameworks = []) {
  return makeExportData("controls", "Compliance", COMPLIANCE_COLUMNS, buildComplianceRows(lens, families, frameworks));
}

export function historyExport(items, meta) {
  return makeExportData("history", "Cloud Provider History", HISTORY_COLUMNS, buildHistoryRows(items, meta));
}

export function transparencyExport(items) {
  return makeExportData("transparency", "State AI Transparency", TRANSPARENCY_COLUMNS, buildTransparencyRows(items));
}

export function downloadCsv(exportData) {
  const lines = rowsToAoA(exportData.rows, exportData.columns).map(row => row.map(csvCell).join(","));
  const csv = `\ufeff${lines.join("\r\n")}`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), fileName(exportData.viewId, "csv"));
}

export function downloadXlsx(exportData) {
  const worksheet = XLSX.utils.aoa_to_sheet(rowsToAoA(exportData.rows, exportData.columns));
  worksheet["!cols"] = autoWidths(exportData.rows, exportData.columns);
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: exportData.rows.length, c: exportData.columns.length - 1 },
    }),
  };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName(exportData.label));
  XLSX.writeFile(workbook, fileName(exportData.viewId, "xlsx"), { compression: true });
}

export function printExport(exportData) {
  const originalTitle = document.title;
  document.title = fileName(exportData.viewId, "pdf");
  window.print();
  window.setTimeout(() => {
    document.title = originalTitle;
  }, 500);
}
