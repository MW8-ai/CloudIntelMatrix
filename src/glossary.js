export const GOV_AVAILABILITY_GLOSSARY = {
  Full: "Official documentation identifies every product in the mapped service or portfolio as available in the stated environment. Required features and parity still need separate review.",
  Partial: "Official documentation establishes only part of a combined portfolio, or support varies by a stated control package.",
  Limited: "Official documentation establishes availability and identifies material environment-specific feature or workflow constraints.",
  None: "Official documentation establishes that the mapped service is not available in the named government or regulated environment.",
  Unknown: "Public official evidence has not established a stronger availability statement for the mapped service or portfolio.",
};

export const PARITY_LAG_GLOSSARY = {
  None: "No commercial-to-regulated parity lag is recorded for this mapped service.",
  Minor: "Official documentation identifies a narrow feature, region, SKU, or workflow difference that may matter in some designs.",
  Moderate: "Official documentation identifies a material commercial-to-regulated difference that should be reviewed before architecture selection.",
  Significant: "Official documentation identifies a broad or high-impact difference between commercial and regulated environments.",
  Unknown: "Commercial-to-regulated feature parity has not been established from official public sources.",
};

export function getTagGlossary(tagDefs, tagKey) {
  const def = tagDefs?.[tagKey];
  if (!def) return null;
  return {
    label: def.label || tagKey,
    description: def.description || "No glossary definition is recorded for this tag.",
  };
}

export function getGovAvailabilityGlossary(value) {
  return {
    label: value,
    description: GOV_AVAILABILITY_GLOSSARY[value] || GOV_AVAILABILITY_GLOSSARY.Unknown,
  };
}

export function getParityLagGlossary(value) {
  return {
    label: value,
    description: PARITY_LAG_GLOSSARY[value] || PARITY_LAG_GLOSSARY.Unknown,
  };
}

export function glossaryTitle(label, description) {
  return `${label}: ${description}`;
}
