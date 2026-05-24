type Triplet = { light: string; dark: string; dim: string };

const PALETTE: Record<string, Triplet> = {
  // People & groups
  PERSON:      { light: "#ffd6a5", dark: "#d99457", dim: "#3d2b16" },
  PER:         { light: "#ffd6a5", dark: "#d99457", dim: "#3d2b16" },
  NORP:        { light: "#ffadad", dark: "#d65a5a", dim: "#3d1616" },
  // Organizations & places
  ORG:         { light: "#bae1ff", dark: "#5fa8d3", dim: "#162840" },
  GPE:         { light: "#a0e7e5", dark: "#4fb3b1", dim: "#163332" },
  LOC:         { light: "#baffc9", dark: "#5cc46f", dim: "#163d22" },
  FAC:         { light: "#d4b8e8", dark: "#9572b5", dim: "#2b1a40" },
  // Things
  PRODUCT:     { light: "#fdffb6", dark: "#c8c870", dim: "#33330e" },
  EVENT:       { light: "#ffb5a7", dark: "#c97560", dim: "#3d201a" },
  WORK_OF_ART: { light: "#fdc5e6", dark: "#c47aa3", dim: "#3d1a2d" },
  LAW:         { light: "#c9d6df", dark: "#7a8a98", dim: "#1d2b33" },
  LANGUAGE:    { light: "#caffbf", dark: "#82c075", dim: "#1a331e" },
  // Numbers, dates, money
  DATE:        { light: "#f5cba7", dark: "#c08654", dim: "#33250e" },
  TIME:        { light: "#e0bbff", dark: "#9a6ec4", dim: "#261633" },
  PERCENT:     { light: "#b8e8d4", dark: "#5fae8c", dim: "#16302a" },
  MONEY:       { light: "#a9e5a9", dark: "#5fa85f", dim: "#163316" },
  QUANTITY:    { light: "#f4d35e", dark: "#bd9b34", dim: "#332a0a" },
  ORDINAL:     { light: "#ffe5b4", dark: "#c7a35a", dim: "#332a14" },
  CARDINAL:    { light: "#9be7a8", dark: "#4faa61", dim: "#16331e" },
  // Fallback bucket for HRL/MISC and anything unrecognized
  MISC:        { light: "#ffffba", dark: "#c7c764", dim: "#333319" },
};

const FALLBACK: Triplet = { light: "#e8daef", dark: "#8e6da6", dim: "#221633" };

export function entityColor(type: string): string {
  return (PALETTE[type] ?? FALLBACK).light;
}

export function entityColorDark(type: string): string {
  return (PALETTE[type] ?? FALLBACK).dark;
}

export function entityColorDim(type: string): string {
  return (PALETTE[type] ?? FALLBACK).dim;
}
