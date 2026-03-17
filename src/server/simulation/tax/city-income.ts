// ─────────────────────────────────────────────────────────────────────────────
// City / Local Income Tax Engine
// ─────────────────────────────────────────────────────────────────────────────
//
// Models local income taxes for US cities/counties where they are material.
// "cityCode" is a short identifier stored on the user profile (e.g. "NYC").
//
// Income base notes:
//   "earned"   — W-2 wages + net self-employment only (not LTCG or passive)
//   "ordinary" — All ordinary income (wages + interest + rental + distributions)
//   "all"      — All taxable income including LTCG (NYC model)
//
// Sources: 2024/2025 local tax authority rates.
// ─────────────────────────────────────────────────────────────────────────────

import type { FilingStatus } from "./types";

interface CityBracket {
  rate: number;
  upTo: number;
}

interface CityConfig {
  name: string;
  state: string;
  incomeBase: "earned" | "ordinary" | "all";
  type: "flat" | "brackets" | "pct_of_state_tax";
  flatRate?: number;
  brackets?: { single: CityBracket[]; married_filing_jointly: CityBracket[] };
  /** Threshold below which no tax is owed (annual income) */
  threshold?: { single: number; married_filing_jointly: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// City Config Table
// ─────────────────────────────────────────────────────────────────────────────

export const CITY_CONFIGS: Record<string, CityConfig> = {
  // ── New York ──────────────────────────────────────────────────────────────
  NYC: {
    name: "New York City",
    state: "NY",
    incomeBase: "all",
    type: "brackets",
    brackets: {
      // 2024 NYC resident income tax brackets
      single: [
        { rate: 0.03078, upTo: 12_000 },
        { rate: 0.03762, upTo: 25_000 },
        { rate: 0.03819, upTo: 50_000 },
        { rate: 0.03876, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.03078, upTo: 21_600 },
        { rate: 0.03762, upTo: 45_000 },
        { rate: 0.03819, upTo: 90_000 },
        { rate: 0.03876, upTo: Infinity },
      ],
    },
  },

  YNK: {
    name: "Yonkers",
    state: "NY",
    incomeBase: "all",
    // Yonkers resident surcharge: 16.75% of NY state tax
    // Modeled here as a flat approximation; actual engine applies it post-state-calc.
    // We approximate as ~2% effective flat rate for simplicity in forward projection.
    type: "flat",
    flatRate: 0.02,
  },

  // ── Pennsylvania ──────────────────────────────────────────────────────────
  PHL: {
    name: "Philadelphia",
    state: "PA",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.0375, // 3.75% resident rate (2024)
  },

  // ── Ohio ──────────────────────────────────────────────────────────────────
  CMH: {
    name: "Columbus",
    state: "OH",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.025,
  },
  CLE: {
    name: "Cleveland",
    state: "OH",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.025,
  },
  CVG: {
    name: "Cincinnati",
    state: "OH",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.018,
  },
  TOL: {
    name: "Toledo",
    state: "OH",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.0225,
  },
  CAK: {
    name: "Akron",
    state: "OH",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.025,
  },
  DAY: {
    name: "Dayton",
    state: "OH",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.0225,
  },

  // ── Missouri ──────────────────────────────────────────────────────────────
  MCI: {
    name: "Kansas City",
    state: "MO",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.01,
  },
  STL: {
    name: "St. Louis",
    state: "MO",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.01,
  },

  // ── Kentucky ──────────────────────────────────────────────────────────────
  SDF: {
    name: "Louisville (Jefferson County)",
    state: "KY",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.0228, // Jefferson County occupational tax (2024)
  },
  LEX: {
    name: "Lexington (Fayette County)",
    state: "KY",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.0225,
  },

  // ── Michigan ──────────────────────────────────────────────────────────────
  DTW: {
    name: "Detroit",
    state: "MI",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.024,
  },
  GRR: {
    name: "Grand Rapids",
    state: "MI",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.015,
  },
  LAN: {
    name: "Lansing",
    state: "MI",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.01,
  },
  FLN: {
    name: "Flint",
    state: "MI",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.015,
  },

  // ── Maryland ──────────────────────────────────────────────────────────────
  BWI: {
    name: "Baltimore City",
    state: "MD",
    incomeBase: "ordinary",
    type: "flat",
    flatRate: 0.032, // Baltimore City income tax (piggyback) — 3.2%
  },

  // ── Oregon ────────────────────────────────────────────────────────────────
  PDX: {
    name: "Portland (Metro SHS + Multnomah PFA)",
    state: "OR",
    incomeBase: "all",
    type: "brackets",
    // Combined Metro SHS (1%) + Multnomah PFA (1.5% / 3%) rates
    // Metro: 1% on income > $125K single / $200K MFJ
    // Multnomah PFA: 1.5% on $125K-$250K single ($200K-$400K MFJ); 3% above that
    // Combined bracket above thresholds (stacked):
    brackets: {
      single: [
        { rate: 0.000, upTo: 125_000 },    // exempt below threshold
        { rate: 0.025, upTo: 250_000 },    // Metro 1% + Multnomah 1.5% = 2.5%
        { rate: 0.040, upTo: Infinity },   // Metro 1% + Multnomah 3% = 4%
      ],
      married_filing_jointly: [
        { rate: 0.000, upTo: 200_000 },
        { rate: 0.025, upTo: 400_000 },
        { rate: 0.040, upTo: Infinity },
      ],
    },
  },

  // ── Alabama ───────────────────────────────────────────────────────────────
  BHM: {
    name: "Birmingham",
    state: "AL",
    incomeBase: "earned",
    type: "flat",
    flatRate: 0.01,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Cities available per state (for profile form dropdown)
// ─────────────────────────────────────────────────────────────────────────────

export const CITIES_BY_STATE: Record<string, Array<{ code: string; name: string }>> = {
  NY: [
    { code: "NYC", name: "New York City" },
    { code: "YNK", name: "Yonkers" },
  ],
  PA: [{ code: "PHL", name: "Philadelphia" }],
  OH: [
    { code: "CMH", name: "Columbus" },
    { code: "CLE", name: "Cleveland" },
    { code: "CVG", name: "Cincinnati" },
    { code: "TOL", name: "Toledo" },
    { code: "CAK", name: "Akron" },
    { code: "DAY", name: "Dayton" },
  ],
  MO: [
    { code: "MCI", name: "Kansas City" },
    { code: "STL", name: "St. Louis" },
  ],
  KY: [
    { code: "SDF", name: "Louisville (Jefferson County)" },
    { code: "LEX", name: "Lexington (Fayette County)" },
  ],
  MI: [
    { code: "DTW", name: "Detroit" },
    { code: "GRR", name: "Grand Rapids" },
    { code: "LAN", name: "Lansing" },
    { code: "FLN", name: "Flint" },
  ],
  MD: [{ code: "BWI", name: "Baltimore City" }],
  OR: [{ code: "PDX", name: "Portland (Metro + Multnomah County)" }],
  AL: [{ code: "BHM", name: "Birmingham" }],
};

// ─────────────────────────────────────────────────────────────────────────────
// Progressive bracket calculator
// ─────────────────────────────────────────────────────────────────────────────

function applyCityBrackets(brackets: CityBracket[], income: number): number {
  if (income <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const bracket of brackets) {
    if (income <= prev) break;
    const taxable = Math.min(income, bracket.upTo) - prev;
    tax += taxable * bracket.rate;
    prev = bracket.upTo;
    if (bracket.upTo === Infinity) break;
  }
  return tax;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main calculator
// ─────────────────────────────────────────────────────────────────────────────

export interface CityTaxInput {
  cityCode: string;
  /** W-2 wages (salary + bonus). Used when incomeBase = "earned". */
  w2Wages: number;
  /** All ordinary income (W-2 + rental + interest + LP ordinary). Used when incomeBase = "ordinary". */
  ordinaryIncome: number;
  /** Long-term capital gains. Added to base when incomeBase = "all". */
  longTermGains: number;
  filingStatus: FilingStatus;
}

export function calculateCityTax(input: CityTaxInput): number {
  const config = CITY_CONFIGS[input.cityCode.trim().toUpperCase()];
  if (!config) return 0;

  // Determine the taxable income base
  let taxableIncome: number;
  if (config.incomeBase === "earned") {
    taxableIncome = Math.max(0, input.w2Wages);
  } else if (config.incomeBase === "ordinary") {
    taxableIncome = Math.max(0, input.ordinaryIncome);
  } else {
    // "all" — ordinary + LTCG
    taxableIncome = Math.max(0, input.ordinaryIncome + input.longTermGains);
  }

  if (config.type === "flat" && config.flatRate !== undefined) {
    return taxableIncome * config.flatRate;
  }

  if (config.type === "brackets" && config.brackets) {
    return applyCityBrackets(config.brackets[input.filingStatus], taxableIncome);
  }

  return 0;
}
