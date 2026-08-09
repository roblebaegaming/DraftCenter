import { DRAFT_PRICING_PRESET_DATA } from "./draft-pricing-preset-data.js";

export const BST_PRICING_PRESET_ID = "bst-v1";
export const LEGACY_PRICING_PRESET_PREFIX = "legacy:";

export const DEFAULT_PRICING_PRESET_IDS = Object.freeze({
  "reg-mb": "smogon-vgc-reg-mb-2026-06-28",
  "reg-f": "stc-vgc-reg-f-s4-2025-03-18",
  "reg-g": "wbg-vgc-reg-g-2024",
  "reg-h": "wbg-vgc-reg-h-2024",
});

const SOURCE_PRICING_PRESETS = Object.freeze(Object.fromEntries(
  Object.entries(DRAFT_PRICING_PRESET_DATA).map(([id, preset]) => [id, Object.freeze({ ...preset, kind: "source" })]),
));

const SOURCE_PRESET_IDS_BY_REGULATION = Object.freeze(
  Object.values(SOURCE_PRICING_PRESETS).reduce((result, preset) => {
    if (!result[preset.regulationId]) result[preset.regulationId] = [];
    result[preset.regulationId].push(preset.id);
    return result;
  }, {}),
);

function finitePrice(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

export function bstPriceFor(bst, fallback = 10) {
  const numericBst = Number(bst);
  if (!Number.isFinite(numericBst)) return finitePrice(fallback) || 10;
  return Math.min(20, Math.max(1, Math.round((numericBst - 280) / 17)));
}

function legacyCompressedBstPriceFor(bst, fallback = 10) {
  const numericBst = Number(bst);
  if (!Number.isFinite(numericBst)) return finitePrice(fallback) || 10;
  return Math.min(10, Math.max(1, Math.round((numericBst - 280) / 34)));
}

export function legacyPricingPresetId(regulationId) {
  return `${LEGACY_PRICING_PRESET_PREFIX}${regulationId || "reg-mb"}`;
}

export function defaultPricingPresetId(regulationId) {
  return DEFAULT_PRICING_PRESET_IDS[regulationId] || BST_PRICING_PRESET_ID;
}

export function pricingPresetFor(settings, regulation) {
  const regulationId = regulation?.id || settings?.regulationId || "reg-mb";
  const requestedId = settings?.pricingPresetId;
  const sourcePreset = SOURCE_PRICING_PRESETS[requestedId];
  if (sourcePreset?.regulationId === regulationId) return sourcePreset;
  if (requestedId === BST_PRICING_PRESET_ID) {
    return {
      id: BST_PRICING_PRESET_ID,
      regulationId,
      name: "BST starter values",
      version: "v1",
      sourceLabel: "DraftCenter BST formula",
      sourceUrl: null,
      sourceDate: "August 9, 2026",
      ruleset: "1–20 estimate from base stat total",
      pointMax: 20,
      note: "Transparent fallback values for formats without an exact board. Commissioners can import a sheet or edit any price.",
      costs: {},
      kind: "bst",
    };
  }
  if (String(requestedId || "").startsWith(LEGACY_PRICING_PRESET_PREFIX) || !requestedId) {
    return {
      id: legacyPricingPresetId(regulationId),
      regulationId,
      name: "Legacy DraftCenter values",
      version: "preserved",
      sourceLabel: "DraftCenter saved league values",
      sourceUrl: null,
      sourceDate: "Preserved from before versioned presets",
      ruleset: "Historical compatibility",
      pointMax: Number(settings?.priceTierMax) || 20,
      note: "This existing league keeps the pricing behavior it already had. Choose another preset to opt into a versioned board.",
      costs: regulation?.defaultCosts || {},
      kind: "legacy",
    };
  }
  return pricingPresetFor({ ...settings, pricingPresetId: BST_PRICING_PRESET_ID }, regulation);
}

export function pricingPresetOptionsFor(regulationId, selectedId) {
  const sourcePresets = (SOURCE_PRESET_IDS_BY_REGULATION[regulationId] || [])
    .map((id) => SOURCE_PRICING_PRESETS[id]);
  const bst = pricingPresetFor({ regulationId, pricingPresetId: BST_PRICING_PRESET_ID }, { id: regulationId });
  const options = DEFAULT_PRICING_PRESET_IDS[regulationId] ? [...sourcePresets, bst] : [bst, ...sourcePresets];
  if (String(selectedId || "").startsWith(LEGACY_PRICING_PRESET_PREFIX)) {
    options.push(pricingPresetFor({ regulationId, pricingPresetId: selectedId }, { id: regulationId, defaultCosts: {} }));
  }
  return options;
}

export function priceDetailsFor(mon, settings, regulation, { derivedCosts = null } = {}) {
  const override = finitePrice(settings?.costOverrides?.[mon.name]);
  if (override != null) return { cost: override, kind: "commissioner" };
  if (mon.custom) return { cost: finitePrice(mon.cost) || bstPriceFor(mon.bst, mon.cost), kind: "commissioner" };

  const preset = pricingPresetFor(settings, regulation);
  const curated = finitePrice(preset.costs?.[mon.name]);
  if (curated != null) return { cost: curated, kind: preset.kind === "legacy" ? "legacy" : "curated" };

  if (preset.kind === "legacy") {
    const derived = finitePrice(derivedCosts?.[mon.name]);
    if (derived != null) return { cost: derived, kind: "league-derived" };
    const fallback = regulation?.compressedFallback
      ? legacyCompressedBstPriceFor(mon.bst, mon.cost)
      : bstPriceFor(mon.bst, mon.cost);
    return { cost: fallback, kind: "bst" };
  }

  return { cost: bstPriceFor(mon.bst, mon.cost), kind: "bst" };
}

export function priceFor(mon, settings, regulation, options) {
  return priceDetailsFor(mon, settings, regulation, options).cost;
}

export function pricingCoverageFor(pool, settings, regulation, options) {
  const coverage = { curated: 0, bst: 0, commissioner: 0, legacy: 0, leagueDerived: 0 };
  for (const mon of pool || []) {
    const details = typeof options?.detailsFor === "function"
      ? options.detailsFor(mon, settings)
      : priceDetailsFor(mon, settings, regulation, options);
    if (details.kind === "league-derived") coverage.leagueDerived += 1;
    else if (Object.prototype.hasOwnProperty.call(coverage, details.kind)) coverage[details.kind] += 1;
  }
  return coverage;
}

export function pricingCoverageLabel(coverage) {
  const parts = [];
  if (coverage.curated) parts.push(`${coverage.curated} curated`);
  if (coverage.bst) parts.push(`${coverage.bst} BST estimate${coverage.bst === 1 ? "" : "s"}`);
  if (coverage.commissioner) parts.push(`${coverage.commissioner} commissioner edit${coverage.commissioner === 1 ? "" : "s"}`);
  if (coverage.legacy) parts.push(`${coverage.legacy} legacy value${coverage.legacy === 1 ? "" : "s"}`);
  if (coverage.leagueDerived) parts.push(`${coverage.leagueDerived} league-derived`);
  return parts.join(" · ") || "No legal Pokémon";
}

export function priceTierMaxForPreset(presetId, regulationId, currentMax = 20) {
  const preset = pricingPresetFor({ regulationId, pricingPresetId: presetId, priceTierMax: currentMax }, { id: regulationId });
  return preset.kind === "legacy" ? Math.max(2, Number(currentMax) || 20) : Math.max(2, Number(preset.pointMax) || 20);
}

export { DRAFT_PRICING_PRESET_DATA };
