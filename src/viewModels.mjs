export const PROVIDER_LABELS = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  oci: "OCI",
};

export const PROVIDER_KEYS_BY_LABEL = Object.fromEntries(
  Object.entries(PROVIDER_LABELS).map(([key, label]) => [label, key])
);

export const DESIGN_LAYERS = [
  {
    id: "foundation",
    label: "Foundation",
    categories: ["Core Infrastructure", "Storage", "Networking"],
  },
  {
    id: "data-ai",
    label: "Data & AI",
    categories: ["Databases", "Data & Analytics", "AI / ML"],
  },
  {
    id: "apps-integration",
    label: "Apps & Integration",
    categories: ["Integration & Messaging", "Developer Platform"],
  },
  {
    id: "security-governance",
    label: "Security & Governance",
    categories: [
      "Identity & Access",
      "Security & Compliance",
      "Monitoring & Operations",
      "Cost Governance",
    ],
  },
  {
    id: "operating-model",
    label: "Operating Model",
    categories: ["Government / Sovereign Cloud", "Hybrid / Edge"],
  },
];

export const CATEGORY_TO_LAYER = Object.fromEntries(
  DESIGN_LAYERS.flatMap(layer =>
    layer.categories.map(category => [category, layer.label])
  )
);

function empty(value) {
  return value == null ? "" : value;
}

function providerLabel(providerKey) {
  return PROVIDER_LABELS[providerKey] || providerKey;
}

function mapProvider(providerKey, provider = {}) {
  return {
    key: providerKey,
    label: providerLabel(providerKey),
    svc: empty(provider.service),
    status: empty(provider.status),
    gov: empty(provider.govAvailability),
    lag: empty(provider.parityLag),
    variant: empty(provider.govVariant),
    region: empty(provider.region),
    realmClass: empty(provider.realmClass),
    lastVerified: empty(provider.lastVerified),
    note: empty(provider.sourceNotes),
    doc: empty(provider.docsUrl),
    govdoc: empty(provider.govDocsUrl),
    price: empty(provider.pricingUrl),
    compliance: empty(provider.complianceUrl),
    formerNames: provider.formerNames || [],
    tierNotes: provider.tierNotes || {},
  };
}

export function buildDesignMeta(matrixData) {
  const providerKeys = matrixData._meta?.providers || [];
  return {
    version: matrixData._meta?.version || "",
    schema: matrixData._meta?.schema || "",
    lastVerified: matrixData._meta?.last_verified || "",
    providerKeys,
    providers: providerKeys.map(providerLabel),
    availabilityLevels: ["Full", "Partial", "Limited", "None", "Unknown"],
    parityLevels: ["None", "Minor", "Moderate", "Significant", "Unknown"],
    layers: DESIGN_LAYERS,
  };
}

export function buildDesignCapabilityRows(matrixData) {
  const providerKeys = matrixData._meta?.providers || [];
  return (matrixData.capabilities || []).map(capability => ({
    cap: capability.capability,
    cat: capability.category,
    layer: CATEGORY_TO_LAYER[capability.category] || "Operating Model",
    ai: capability.aiClassification,
    tags: capability.tags || [],
    architectureNotes: empty(capability.architectureNotes),
    operationalConsiderations: empty(capability.operationalConsiderations),
    lastVerified: empty(capability.lastVerified),
    providers: Object.fromEntries(
      providerKeys.map(providerKey => [
        providerLabel(providerKey),
        mapProvider(providerKey, capability.providers?.[providerKey]),
      ])
    ),
  }));
}

export function buildDesignPatterns(matrixData) {
  return (matrixData.patterns || []).map(pattern => ({
    id: pattern.id,
    name: pattern.name,
    summary: pattern.summary,
    whenToUse: pattern.whenToUse,
    caps: pattern.capabilities || [],
    prompts: pattern.reviewPrompts || [],
    note: pattern.verificationNote || "",
    lastVerified: pattern.lastVerified || "",
  }));
}

export function buildDesignControls(matrixData) {
  const lens = matrixData.controlLens || {};
  return {
    disclaimer: lens.scopeNote || "",
    familySource: lens.name || "",
    familyRelease: lens.release || "",
    catalogUrl: lens.catalogUrl || "",
    baselineUrl: lens.baselineUrl || "",
    oscalUrl: lens.oscalUrl || "",
    frameworks: matrixData.complianceFrameworks || [],
    families: (lens.families || []).map(family => ({
      id: family.id,
      name: family.name,
      scope: family.applicability,
      caps: family.capabilities || [],
      prompts: family.reviewPrompts || [],
    })),
  };
}

export function buildDesignHistory(historyData) {
  return (historyData.history || []).map(item => ({
    ...item,
    providerKey: item.provider,
    provider: providerLabel(item.provider),
  }));
}

export function buildDesignFramework(matrixData) {
  const frameworks = matrixData.frameworks || {};
  return Object.fromEntries(
    Object.entries(frameworks).map(([providerKey, framework]) => [
      providerLabel(providerKey),
      {
        key: providerKey,
        label: providerLabel(providerKey),
        ...framework,
      },
    ])
  );
}

export function groupRowsByLayer(rows) {
  const layerOrder = DESIGN_LAYERS.map(layer => layer.label);
  const grouped = new Map();
  for (const row of rows) {
    const layer = row.layer || CATEGORY_TO_LAYER[row.cat] || "Operating Model";
    const categoryMap = grouped.get(layer) || new Map();
    const list = categoryMap.get(row.cat) || [];
    list.push(row);
    categoryMap.set(row.cat, list);
    grouped.set(layer, categoryMap);
  }

  return layerOrder
    .filter(layer => grouped.has(layer))
    .map(layer => ({
      layer,
      categories: Array.from(grouped.get(layer).entries()).map(([category, items]) => ({
        category,
        items,
      })),
    }));
}

export function buildDesignViewModel({ matrixData, historyData = {}, transparencyData = {}, upcomingData = {} }) {
  const capabilityRows = buildDesignCapabilityRows(matrixData);

  return {
    CIM_META: buildDesignMeta(matrixData),
    CIM_DATA: capabilityRows,
    CIM_PATTERNS: buildDesignPatterns(matrixData),
    CIM_CONTROLS: buildDesignControls(matrixData),
    CIM_HISTORY: buildDesignHistory(historyData),
    CIM_FRAMEWORK: buildDesignFramework(matrixData),
    CIM_TRANSPARENCY: transparencyData.mandates || [],
    CIM_TRANSPARENCY_META: transparencyData._meta || {},
    CIM_UPCOMING: upcomingData.upcoming || [],
    CIM_GROUPED_LAYERS: groupRowsByLayer(capabilityRows),
  };
}
