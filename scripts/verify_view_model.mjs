#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CATEGORY_TO_LAYER,
  PROVIDER_LABELS,
  buildDesignViewModel,
} from "../src/viewModels.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"));
}

function norm(value) {
  return value == null ? "" : value;
}

function sameArray(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

const matrixData = await readJson("data/matrix.json");
const historyData = await readJson("data/history.json");
const transparencyData = await readJson("data/transparency.json");
const upcomingData = await readJson("data/upcoming.json");
const model = buildDesignViewModel({ matrixData, historyData, transparencyData, upcomingData });

const errors = [];
const err = message => errors.push(message);

const capabilities = matrixData.capabilities || [];
const providerKeys = matrixData._meta?.providers || [];
const capabilityByName = new Map(capabilities.map(capability => [capability.capability, capability]));
const designRowByName = new Map(model.CIM_DATA.map(row => [row.cap, row]));

if (model.CIM_DATA.length !== capabilities.length) {
  err(`CIM_DATA has ${model.CIM_DATA.length} rows; expected ${capabilities.length}.`);
}

if (model.CIM_META.providers.length !== providerKeys.length) {
  err(`CIM_META has ${model.CIM_META.providers.length} providers; expected ${providerKeys.length}.`);
}

for (const category of matrixData.categories || []) {
  if (!CATEGORY_TO_LAYER[category]) {
    err(`Category "${category}" is missing a design layer mapping.`);
  }
}

for (const capability of capabilities) {
  const row = designRowByName.get(capability.capability);
  if (!row) {
    err(`Missing design row for capability "${capability.capability}".`);
    continue;
  }
  if (row.cat !== capability.category) {
    err(`Capability "${capability.capability}" category changed in view model.`);
  }
  if (row.ai !== capability.aiClassification) {
    err(`Capability "${capability.capability}" AI classification changed in view model.`);
  }

  for (const providerKey of providerKeys) {
    const label = PROVIDER_LABELS[providerKey];
    const source = capability.providers?.[providerKey] || {};
    const mapped = row.providers?.[label];
    if (!mapped) {
      err(`Missing ${label} mapping for capability "${capability.capability}".`);
      continue;
    }

    const fieldMap = [
      ["svc", "service"],
      ["status", "status"],
      ["gov", "govAvailability"],
      ["lag", "parityLag"],
      ["variant", "govVariant"],
      ["note", "sourceNotes"],
      ["doc", "docsUrl"],
      ["govdoc", "govDocsUrl"],
      ["price", "pricingUrl"],
      ["compliance", "complianceUrl"],
    ];

    for (const [mappedField, sourceField] of fieldMap) {
      if (norm(mapped[mappedField]) !== norm(source[sourceField])) {
        err(`Field ${mappedField}/${sourceField} drifted for "${capability.capability}" ${label}.`);
      }
    }

    if (!sameArray(mapped.formerNames, source.formerNames)) {
      err(`formerNames drifted for "${capability.capability}" ${label}.`);
    }
  }
}

const providerCellCount = model.CIM_DATA.reduce(
  (count, row) => count + Object.keys(row.providers || {}).length,
  0
);
const expectedProviderCellCount = capabilities.length * providerKeys.length;
if (providerCellCount !== expectedProviderCellCount) {
  err(`Design view model has ${providerCellCount} provider cells; expected ${expectedProviderCellCount}.`);
}

for (const pattern of matrixData.patterns || []) {
  const mapped = model.CIM_PATTERNS.find(item => item.id === pattern.id);
  if (!mapped) {
    err(`Missing pattern "${pattern.id}" in view model.`);
    continue;
  }
  if (!sameArray(mapped.caps, pattern.capabilities)) {
    err(`Pattern "${pattern.id}" capabilities drifted in view model.`);
  }
  for (const capabilityName of mapped.caps) {
    if (!capabilityByName.has(capabilityName)) {
      err(`Pattern "${pattern.id}" references unknown capability "${capabilityName}".`);
    }
  }
}

if (model.CIM_PATTERNS.length !== (matrixData.patterns || []).length) {
  err(`CIM_PATTERNS has ${model.CIM_PATTERNS.length} rows; expected ${(matrixData.patterns || []).length}.`);
}

if (model.CIM_CONTROLS.frameworks.length !== (matrixData.complianceFrameworks || []).length) {
  err("Compliance framework count drifted in view model.");
}

if (model.CIM_CONTROLS.families.length !== (matrixData.controlLens?.families || []).length) {
  err("NIST family count drifted in view model.");
}

for (const family of model.CIM_CONTROLS.families) {
  for (const capabilityName of family.caps || []) {
    if (!capabilityByName.has(capabilityName)) {
      err(`NIST family "${family.id}" references unknown capability "${capabilityName}".`);
    }
  }
}

for (const providerKey of providerKeys) {
  const label = PROVIDER_LABELS[providerKey];
  if (!model.CIM_FRAMEWORK[label]) {
    err(`Missing provider framework mapping for ${label}.`);
  }
}

if (model.CIM_HISTORY.length !== (historyData.history || []).length) {
  err(`CIM_HISTORY has ${model.CIM_HISTORY.length} rows; expected ${(historyData.history || []).length}.`);
}

if (model.CIM_TRANSPARENCY.length !== (transparencyData.mandates || []).length) {
  err(`CIM_TRANSPARENCY has ${model.CIM_TRANSPARENCY.length} rows; expected ${(transparencyData.mandates || []).length}.`);
}

if (model.CIM_UPCOMING.length !== (upcomingData.upcoming || []).length) {
  err(`CIM_UPCOMING has ${model.CIM_UPCOMING.length} rows; expected ${(upcomingData.upcoming || []).length}.`);
}

if (errors.length) {
  console.error("Design view model verification failed:");
  for (const message of errors) {
    console.error(`  ERROR: ${message}`);
  }
  process.exit(1);
}

console.log(
  `Design view model verified: ${model.CIM_DATA.length} capabilities, ${providerCellCount} provider cells, ` +
  `${model.CIM_PATTERNS.length} patterns, ${model.CIM_CONTROLS.frameworks.length} frameworks, ` +
  `${model.CIM_CONTROLS.families.length} NIST families.`
);
