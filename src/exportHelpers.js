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
  "formerNames",
  "status",
  "govAvailability",
  "parityLag",
  "govVariant",
  "region",
  "realmClass",
  "providerLastVerified",
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

const STATUS_COLUMNS = [
  "providerName",
  "category",
  "name",
  "summary",
  "statusUrl",
  "historyUrl",
  "docsUrl",
  "lastVerified",
];

const AI_WATCH_COLUMNS = [
  "name",
  "shortName",
  "category",
  "modelFamily",
  "summary",
  "newsUrl",
  "docsUrl",
  "releaseNotesUrl",
  "safetyUrl",
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
  return asText(label).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Export";
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
    return Math.max(10, Math.min(64, maxCell + 2));
  });
}

function xmlText(value) {
  return asText(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function worksheetXml(exportData) {
  const columns = exportData.columns;
  const rows = rowsToAoA(exportData.rows, columns);
  const widths = autoWidths(exportData.rows, columns);
  const lastColumn = columnName(Math.max(columns.length - 1, 0));
  const lastRow = Math.max(rows.length, 1);
  const dimensionRef = `A1:${lastColumn}${lastRow}`;
  const colsXml = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  const sheetData = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowNumber}`;
          const style = rowIndex === 0 ? ' s="1"' : "";
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="${dimensionRef}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft"/>
    </sheetView>
  </sheetViews>
  <cols>${colsXml}</cols>
  <sheetData>${sheetData}</sheetData>
  <autoFilter ref="${dimensionRef}"/>
</worksheet>`;
}

function workbookXml(label) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <workbookPr date1904="false"/>
  <sheets>
    <sheet name="${xmlText(sheetName(label))}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    value = CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(now = new Date()) {
  const year = Math.max(now.getFullYear(), 1980);
  return {
    time: (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate(),
  };
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function createZip(files) {
  const encoder = new TextEncoder();
  const timestamp = dosDateTime();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const checksum = crc32(dataBytes);
    const localHeader = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(timestamp.time),
      u16(timestamp.date),
      u32(checksum),
      u32(dataBytes.length),
      u32(dataBytes.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, dataBytes);

    const centralHeader = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(timestamp.time),
      u16(timestamp.date),
      u32(checksum),
      u32(dataBytes.length),
      u32(dataBytes.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    centralParts.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const endRecord = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDirectory.length),
    u32(offset),
    u16(0),
  ]);

  return concatBytes([...localParts, centralDirectory, endRecord]);
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
        formerNames: provider.formerNames || [],
        status: provider.status,
        govAvailability: provider.govAvailability,
        parityLag: provider.parityLag,
        govVariant: provider.govVariant,
        region: provider.region,
        realmClass: provider.realmClass,
        providerLastVerified: provider.lastVerified,
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

export function buildStatusRows(items) {
  return items.map(item => ({
    providerName: item.providerName,
    category: item.category,
    name: item.name,
    summary: item.summary,
    statusUrl: item.statusUrl,
    historyUrl: item.historyUrl,
    docsUrl: item.docsUrl,
    lastVerified: item.lastVerified,
  }));
}

export function buildAiWatchRows(items) {
  return items.map(item => ({
    name: item.name,
    shortName: item.shortName,
    category: item.category,
    modelFamily: item.modelFamily,
    summary: item.summary,
    newsUrl: item.newsUrl,
    docsUrl: item.docsUrl,
    releaseNotesUrl: item.releaseNotesUrl,
    safetyUrl: item.safetyUrl,
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

export function statusExport(items) {
  return makeExportData("status", "Operational Status Sources", STATUS_COLUMNS, buildStatusRows(items));
}

export function aiWatchExport(items) {
  return makeExportData("ai-watch", "AI Lab Watch", AI_WATCH_COLUMNS, buildAiWatchRows(items));
}

export function downloadCsv(exportData) {
  const lines = rowsToAoA(exportData.rows, exportData.columns).map(row => row.map(csvCell).join(","));
  const csv = `\ufeff${lines.join("\r\n")}`;
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), fileName(exportData.viewId, "csv"));
}

export function createXlsxBlob(exportData) {
  const files = [
    { name: "[Content_Types].xml", content: contentTypesXml() },
    { name: "_rels/.rels", content: rootRelsXml() },
    { name: "xl/workbook.xml", content: workbookXml(exportData.label) },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRelsXml() },
    { name: "xl/styles.xml", content: stylesXml() },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(exportData) },
  ];
  return new Blob([createZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadXlsx(exportData) {
  downloadBlob(
    createXlsxBlob(exportData),
    fileName(exportData.viewId, "xlsx")
  );
}

export function printExport(exportData) {
  const originalTitle = document.title;
  document.title = fileName(exportData.viewId, "pdf");
  window.print();
  window.setTimeout(() => {
    document.title = originalTitle;
  }, 500);
}
