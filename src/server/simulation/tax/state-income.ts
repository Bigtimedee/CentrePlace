// ─────────────────────────────────────────────────────────────────────────────
// State Income Tax Engine — All 50 States + DC
// ─────────────────────────────────────────────────────────────────────────────
//
// Sources: Tax Foundation 2025 State Individual Income Tax Rates and Brackets
// Note: "flat_rate" states use a single rate; "brackets" states use progressive.
// States with no income tax return zero.
//
// LTCG treatment key:
//   "ordinary"      — taxed as regular income (most states)
//   "preferential"  — reduced rate or partial exclusion
//   "exempt"        — no state capital gains tax

import type { FilingStatus, StateTaxInput, StateTaxResult } from "./types";
import { calculateCityTax } from "./city-income";

interface StateBracket {
  rate: number;
  upTo: number;
}

interface StateConfig {
  type: "none" | "flat_rate" | "brackets";
  flatRate?: number;
  brackets?: { single: StateBracket[]; married_filing_jointly: StateBracket[] };
  ltcgTreatment: "ordinary" | "preferential" | "exempt";
  ltcgRate?: number; // only used when treatment = "preferential" with a fixed rate
  ltcgExclusionPct?: number; // partial exclusion (e.g., 0.4 = 40% excluded)
  /** Special rate for short-term capital gains (e.g. MA 8.5%). When set, STG are
   *  excluded from the ordinary bracket calculation and taxed at this rate instead. */
  shortTermGainsRate?: number;
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// State Configuration Table
// ─────────────────────────────────────────────────────────────────────────────

const STATE_CONFIGS: Record<string, StateConfig> = {
  // ── No Income Tax States ──────────────────────────────────────────────────
  AK: { type: "none", ltcgTreatment: "exempt" },
  FL: { type: "none", ltcgTreatment: "exempt" },
  NV: { type: "none", ltcgTreatment: "exempt" },
  NH: { type: "none", ltcgTreatment: "exempt", notes: "NH dividend/interest tax fully phased out as of 2025" },
  SD: { type: "none", ltcgTreatment: "exempt" },
  TN: { type: "none", ltcgTreatment: "exempt" },
  TX: { type: "none", ltcgTreatment: "exempt" },
  WA: { type: "none", ltcgTreatment: "exempt", notes: "WA 7% capital gains excise tax on LTCG above $262K — computed in calculateStateTax" },
  WY: { type: "none", ltcgTreatment: "exempt" },

  // ── Flat Rate States ──────────────────────────────────────────────────────
  AZ: { type: "flat_rate", flatRate: 0.025, ltcgTreatment: "ordinary" },
  CO: { type: "flat_rate", flatRate: 0.044, ltcgTreatment: "ordinary" },
  GA: { type: "flat_rate", flatRate: 0.055, ltcgTreatment: "ordinary" },
  ID: { type: "flat_rate", flatRate: 0.058, ltcgTreatment: "ordinary" },
  IL: { type: "flat_rate", flatRate: 0.0495, ltcgTreatment: "ordinary" },
  IN: { type: "flat_rate", flatRate: 0.0305, ltcgTreatment: "ordinary" },
  KY: { type: "flat_rate", flatRate: 0.04, ltcgTreatment: "ordinary" },
  MA: {
    type: "flat_rate",
    flatRate: 0.05,
    ltcgTreatment: "preferential",
    ltcgRate: 0.05,
    shortTermGainsRate: 0.085,
    notes: "MA taxes LTCG at 5%; short-term capital gains at 8.5% (Part A income)",
  },
  MI: { type: "flat_rate", flatRate: 0.0425, ltcgTreatment: "ordinary" },
  NC: { type: "flat_rate", flatRate: 0.045, ltcgTreatment: "ordinary" },
  PA: {
    type: "flat_rate",
    flatRate: 0.0307,
    ltcgTreatment: "ordinary",
    notes: "PA taxes net gains as ordinary income",
  },
  UT: { type: "flat_rate", flatRate: 0.0465, ltcgTreatment: "ordinary" },

  // ── Progressive States ────────────────────────────────────────────────────
  AL: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.02, upTo: 500 },
        { rate: 0.04, upTo: 3_000 },
        { rate: 0.05, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.02, upTo: 1_000 },
        { rate: 0.04, upTo: 6_000 },
        { rate: 0.05, upTo: Infinity },
      ],
    },
  },
  AR: {
    type: "brackets",
    ltcgTreatment: "preferential",
    ltcgExclusionPct: 0.5,
    notes: "AR excludes 50% of net capital gains",
    brackets: {
      single: [
        { rate: 0.02, upTo: 5_000 },
        { rate: 0.04, upTo: 10_000 },
        { rate: 0.044, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.02, upTo: 5_000 },
        { rate: 0.04, upTo: 10_000 },
        { rate: 0.044, upTo: Infinity },
      ],
    },
  },
  CA: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    notes: "CA taxes LTCG as ordinary income — highest marginal 13.3%",
    brackets: {
      single: [
        { rate: 0.01,   upTo: 10_756 },
        { rate: 0.02,   upTo: 25_499 },
        { rate: 0.04,   upTo: 40_245 },
        { rate: 0.06,   upTo: 55_866 },
        { rate: 0.08,   upTo: 70_606 },
        { rate: 0.093,  upTo: 360_659 },
        { rate: 0.103,  upTo: 432_787 },
        { rate: 0.113,  upTo: 721_314 },
        { rate: 0.123,  upTo: 1_000_000 },
        { rate: 0.133,  upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.01,   upTo: 21_512 },
        { rate: 0.02,   upTo: 50_998 },
        { rate: 0.04,   upTo: 80_490 },
        { rate: 0.06,   upTo: 111_732 },
        { rate: 0.08,   upTo: 141_212 },
        { rate: 0.093,  upTo: 721_318 },
        { rate: 0.103,  upTo: 865_574 },
        { rate: 0.113,  upTo: 1_000_000 },
        { rate: 0.123,  upTo: 1_442_628 },
        { rate: 0.133,  upTo: Infinity },
      ],
    },
  },
  CT: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.03,   upTo: 10_000 },
        { rate: 0.05,   upTo: 50_000 },
        { rate: 0.055,  upTo: 100_000 },
        { rate: 0.06,   upTo: 200_000 },
        { rate: 0.065,  upTo: 250_000 },
        { rate: 0.069,  upTo: 500_000 },
        { rate: 0.0699, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.03,   upTo: 20_000 },
        { rate: 0.05,   upTo: 100_000 },
        { rate: 0.055,  upTo: 200_000 },
        { rate: 0.06,   upTo: 400_000 },
        { rate: 0.065,  upTo: 500_000 },
        { rate: 0.069,  upTo: 1_000_000 },
        { rate: 0.0699, upTo: Infinity },
      ],
    },
  },
  DC: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.04,   upTo: 10_000 },
        { rate: 0.06,   upTo: 40_000 },
        { rate: 0.065,  upTo: 60_000 },
        { rate: 0.085,  upTo: 350_000 },
        { rate: 0.0925, upTo: 1_000_000 },
        { rate: 0.1075, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.04,   upTo: 10_000 },
        { rate: 0.06,   upTo: 40_000 },
        { rate: 0.065,  upTo: 60_000 },
        { rate: 0.085,  upTo: 350_000 },
        { rate: 0.0925, upTo: 1_000_000 },
        { rate: 0.1075, upTo: Infinity },
      ],
    },
  },
  DE: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.00,   upTo: 2_000 },
        { rate: 0.022,  upTo: 5_000 },
        { rate: 0.039,  upTo: 10_000 },
        { rate: 0.048,  upTo: 20_000 },
        { rate: 0.052,  upTo: 25_000 },
        { rate: 0.0555, upTo: 60_000 },
        { rate: 0.066,  upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.00,   upTo: 2_000 },
        { rate: 0.022,  upTo: 5_000 },
        { rate: 0.039,  upTo: 10_000 },
        { rate: 0.048,  upTo: 20_000 },
        { rate: 0.052,  upTo: 25_000 },
        { rate: 0.0555, upTo: 60_000 },
        { rate: 0.066,  upTo: Infinity },
      ],
    },
  },
  HI: {
    type: "brackets",
    ltcgTreatment: "preferential",
    ltcgRate: 0.0725,
    notes: "HI LTCG capped at 7.25%",
    brackets: {
      single: [
        { rate: 0.014,  upTo: 2_400 },
        { rate: 0.032,  upTo: 4_800 },
        { rate: 0.055,  upTo: 9_600 },
        { rate: 0.064,  upTo: 14_400 },
        { rate: 0.068,  upTo: 19_200 },
        { rate: 0.072,  upTo: 24_000 },
        { rate: 0.076,  upTo: 36_000 },
        { rate: 0.079,  upTo: 48_000 },
        { rate: 0.0825, upTo: 150_000 },
        { rate: 0.09,   upTo: 175_000 },
        { rate: 0.10,   upTo: 200_000 },
        { rate: 0.11,   upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.014,  upTo: 4_800 },
        { rate: 0.032,  upTo: 9_600 },
        { rate: 0.055,  upTo: 19_200 },
        { rate: 0.064,  upTo: 28_800 },
        { rate: 0.068,  upTo: 38_400 },
        { rate: 0.072,  upTo: 48_000 },
        { rate: 0.076,  upTo: 72_000 },
        { rate: 0.079,  upTo: 96_000 },
        { rate: 0.0825, upTo: 300_000 },
        { rate: 0.09,   upTo: 350_000 },
        { rate: 0.10,   upTo: 400_000 },
        { rate: 0.11,   upTo: Infinity },
      ],
    },
  },
  IA: {
    type: "flat_rate",
    flatRate: 0.057,
    ltcgTreatment: "ordinary",
    notes: "IA phasing to 3.9% flat by 2026; using projected 2026 rate",
  },
  KS: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.031, upTo: 15_000 },
        { rate: 0.0525, upTo: 30_000 },
        { rate: 0.057, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.031, upTo: 30_000 },
        { rate: 0.0525, upTo: 60_000 },
        { rate: 0.057, upTo: Infinity },
      ],
    },
  },
  LA: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.0185, upTo: 12_500 },
        { rate: 0.035,  upTo: 50_000 },
        { rate: 0.0425, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.0185, upTo: 25_000 },
        { rate: 0.035,  upTo: 100_000 },
        { rate: 0.0425, upTo: Infinity },
      ],
    },
  },
  ME: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.058, upTo: 26_050 },
        { rate: 0.0675, upTo: 61_600 },
        { rate: 0.0715, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.058, upTo: 52_100 },
        { rate: 0.0675, upTo: 123_250 },
        { rate: 0.0715, upTo: Infinity },
      ],
    },
  },
  MD: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.02,   upTo: 1_000 },
        { rate: 0.03,   upTo: 2_000 },
        { rate: 0.04,   upTo: 3_000 },
        { rate: 0.0475, upTo: 100_000 },
        { rate: 0.05,   upTo: 125_000 },
        { rate: 0.0525, upTo: 150_000 },
        { rate: 0.055,  upTo: 250_000 },
        { rate: 0.0575, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.02,   upTo: 1_000 },
        { rate: 0.03,   upTo: 2_000 },
        { rate: 0.04,   upTo: 3_000 },
        { rate: 0.0475, upTo: 150_000 },
        { rate: 0.05,   upTo: 175_000 },
        { rate: 0.0525, upTo: 225_000 },
        { rate: 0.055,  upTo: 300_000 },
        { rate: 0.0575, upTo: Infinity },
      ],
    },
  },
  MN: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.0535, upTo: 31_690 },
        { rate: 0.068,  upTo: 104_090 },
        { rate: 0.0785, upTo: 193_240 },
        { rate: 0.0985, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.0535, upTo: 46_330 },
        { rate: 0.068,  upTo: 184_040 },
        { rate: 0.0785, upTo: 321_450 },
        { rate: 0.0985, upTo: Infinity },
      ],
    },
  },
  MS: {
    type: "flat_rate",
    flatRate: 0.047,
    ltcgTreatment: "ordinary",
    notes: "MS phasing to 4% by 2026",
  },
  MO: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.015, upTo: 1_207 },
        { rate: 0.02,  upTo: 2_414 },
        { rate: 0.025, upTo: 3_621 },
        { rate: 0.03,  upTo: 4_828 },
        { rate: 0.035, upTo: 6_035 },
        { rate: 0.04,  upTo: 7_242 },
        { rate: 0.045, upTo: 8_449 },
        { rate: 0.048, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.015, upTo: 1_207 },
        { rate: 0.02,  upTo: 2_414 },
        { rate: 0.025, upTo: 3_621 },
        { rate: 0.03,  upTo: 4_828 },
        { rate: 0.035, upTo: 6_035 },
        { rate: 0.04,  upTo: 7_242 },
        { rate: 0.045, upTo: 8_449 },
        { rate: 0.048, upTo: Infinity },
      ],
    },
  },
  MT: {
    type: "brackets",
    ltcgTreatment: "preferential",
    ltcgExclusionPct: 0.02,
    notes: "MT allows 2% capital gains credit",
    brackets: {
      single: [
        { rate: 0.01,  upTo: 3_600 },
        { rate: 0.02,  upTo: 6_300 },
        { rate: 0.03,  upTo: 9_700 },
        { rate: 0.04,  upTo: 13_000 },
        { rate: 0.05,  upTo: 16_800 },
        { rate: 0.06,  upTo: 21_600 },
        { rate: 0.069, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.01,  upTo: 3_600 },
        { rate: 0.02,  upTo: 6_300 },
        { rate: 0.03,  upTo: 9_700 },
        { rate: 0.04,  upTo: 13_000 },
        { rate: 0.05,  upTo: 16_800 },
        { rate: 0.06,  upTo: 21_600 },
        { rate: 0.069, upTo: Infinity },
      ],
    },
  },
  NE: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.0246, upTo: 3_700 },
        { rate: 0.0351, upTo: 22_170 },
        { rate: 0.0501, upTo: 35_730 },
        { rate: 0.0664, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.0246, upTo: 7_390 },
        { rate: 0.0351, upTo: 44_340 },
        { rate: 0.0501, upTo: 71_460 },
        { rate: 0.0664, upTo: Infinity },
      ],
    },
  },
  NJ: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.014,  upTo: 20_000 },
        { rate: 0.0175, upTo: 35_000 },
        { rate: 0.035,  upTo: 40_000 },
        { rate: 0.05525, upTo: 75_000 },
        { rate: 0.0637, upTo: 500_000 },
        { rate: 0.0897, upTo: 1_000_000 },
        { rate: 0.1075, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.014,  upTo: 20_000 },
        { rate: 0.0175, upTo: 50_000 },
        { rate: 0.0245, upTo: 70_000 },
        { rate: 0.035,  upTo: 80_000 },
        { rate: 0.05525, upTo: 150_000 },
        { rate: 0.0637, upTo: 500_000 },
        { rate: 0.0897, upTo: 1_000_000 },
        { rate: 0.1075, upTo: Infinity },
      ],
    },
  },
  NM: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.017, upTo: 5_500 },
        { rate: 0.032, upTo: 11_000 },
        { rate: 0.047, upTo: 16_000 },
        { rate: 0.049, upTo: 210_000 },
        { rate: 0.059, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.017, upTo: 8_000 },
        { rate: 0.032, upTo: 16_000 },
        { rate: 0.047, upTo: 24_000 },
        { rate: 0.049, upTo: 315_000 },
        { rate: 0.059, upTo: Infinity },
      ],
    },
  },
  NY: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    notes: "NY taxes LTCG as ordinary income — up to 10.9% plus NYC add-on if applicable",
    brackets: {
      single: [
        { rate: 0.04,   upTo: 17_150 },
        { rate: 0.045,  upTo: 23_600 },
        { rate: 0.0525, upTo: 27_900 },
        { rate: 0.055,  upTo: 161_550 },
        { rate: 0.06,   upTo: 323_200 },
        { rate: 0.0685, upTo: 2_155_350 },
        { rate: 0.0965, upTo: 5_000_000 },
        { rate: 0.103,  upTo: 25_000_000 },
        { rate: 0.109,  upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.04,   upTo: 27_900 },
        { rate: 0.045,  upTo: 43_000 },
        { rate: 0.0525, upTo: 161_550 },
        { rate: 0.055,  upTo: 323_200 },
        { rate: 0.06,   upTo: 2_155_350 },
        { rate: 0.0685, upTo: 5_000_000 },
        { rate: 0.0965, upTo: 25_000_000 },
        { rate: 0.103,  upTo: Infinity },
      ],
    },
  },
  ND: {
    type: "brackets",
    ltcgTreatment: "preferential",
    ltcgExclusionPct: 0.4,
    notes: "ND excludes 40% of net LTCG",
    brackets: {
      single: [
        { rate: 0.0195, upTo: 44_725 },
        { rate: 0.0245, upTo: 225_975 },
        { rate: 0.029,  upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.0195, upTo: 74_750 },
        { rate: 0.0245, upTo: 275_100 },
        { rate: 0.029,  upTo: Infinity },
      ],
    },
  },
  OH: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.00,   upTo: 26_050 },
        { rate: 0.02765, upTo: 100_000 },
        { rate: 0.03226, upTo: 115_300 },
        { rate: 0.03688, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.00,   upTo: 26_050 },
        { rate: 0.02765, upTo: 100_000 },
        { rate: 0.03226, upTo: 115_300 },
        { rate: 0.03688, upTo: Infinity },
      ],
    },
  },
  OK: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.005, upTo: 1_000 },
        { rate: 0.01,  upTo: 2_500 },
        { rate: 0.02,  upTo: 3_750 },
        { rate: 0.03,  upTo: 4_900 },
        { rate: 0.04,  upTo: 7_200 },
        { rate: 0.0475, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.005, upTo: 2_000 },
        { rate: 0.01,  upTo: 5_000 },
        { rate: 0.02,  upTo: 7_500 },
        { rate: 0.03,  upTo: 9_800 },
        { rate: 0.04,  upTo: 12_200 },
        { rate: 0.0475, upTo: Infinity },
      ],
    },
  },
  OR: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.0475, upTo: 18_400 },
        { rate: 0.0675, upTo: 46_200 },
        { rate: 0.0875, upTo: 250_000 },
        { rate: 0.099,  upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.0475, upTo: 18_400 },
        { rate: 0.0675, upTo: 46_200 },
        { rate: 0.0875, upTo: 250_000 },
        { rate: 0.099,  upTo: Infinity },
      ],
    },
  },
  RI: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.0375, upTo: 73_450 },
        { rate: 0.0475, upTo: 166_950 },
        { rate: 0.0599, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.0375, upTo: 73_450 },
        { rate: 0.0475, upTo: 166_950 },
        { rate: 0.0599, upTo: Infinity },
      ],
    },
  },
  SC: {
    type: "brackets",
    ltcgTreatment: "preferential",
    ltcgExclusionPct: 0.44,
    notes: "SC 44% long-term capital gain deduction",
    brackets: {
      single: [
        { rate: 0.00,   upTo: 3_460 },
        { rate: 0.03,   upTo: 17_330 },
        { rate: 0.05,   upTo: 34_660 },
        { rate: 0.0640, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.00,   upTo: 3_460 },
        { rate: 0.03,   upTo: 17_330 },
        { rate: 0.05,   upTo: 34_660 },
        { rate: 0.0640, upTo: Infinity },
      ],
    },
  },
  VT: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.0335, upTo: 45_400 },
        { rate: 0.066,  upTo: 110_050 },
        { rate: 0.076,  upTo: 229_550 },
        { rate: 0.0875, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.0335, upTo: 75_850 },
        { rate: 0.066,  upTo: 183_400 },
        { rate: 0.076,  upTo: 279_450 },
        { rate: 0.0875, upTo: Infinity },
      ],
    },
  },
  VA: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.02,   upTo: 3_000 },
        { rate: 0.03,   upTo: 5_000 },
        { rate: 0.05,   upTo: 17_000 },
        { rate: 0.0575, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.02,   upTo: 3_000 },
        { rate: 0.03,   upTo: 5_000 },
        { rate: 0.05,   upTo: 17_000 },
        { rate: 0.0575, upTo: Infinity },
      ],
    },
  },
  WI: {
    type: "brackets",
    ltcgTreatment: "preferential",
    ltcgExclusionPct: 0.3,
    notes: "WI 30% long-term capital gain exclusion",
    brackets: {
      single: [
        { rate: 0.035,  upTo: 13_810 },
        { rate: 0.044,  upTo: 27_630 },
        { rate: 0.053,  upTo: 304_170 },
        { rate: 0.0765, upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.035,  upTo: 18_420 },
        { rate: 0.044,  upTo: 36_840 },
        { rate: 0.053,  upTo: 405_550 },
        { rate: 0.0765, upTo: Infinity },
      ],
    },
  },
  WV: {
    type: "brackets",
    ltcgTreatment: "ordinary",
    brackets: {
      single: [
        { rate: 0.03,   upTo: 10_000 },
        { rate: 0.04,   upTo: 25_000 },
        { rate: 0.045,  upTo: 40_000 },
        { rate: 0.06,   upTo: 60_000 },
        { rate: 0.065,  upTo: Infinity },
      ],
      married_filing_jointly: [
        { rate: 0.03,   upTo: 10_000 },
        { rate: 0.04,   upTo: 25_000 },
        { rate: 0.045,  upTo: 40_000 },
        { rate: 0.06,   upTo: 60_000 },
        { rate: 0.065,  upTo: Infinity },
      ],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Progressive bracket calculator
// ─────────────────────────────────────────────────────────────────────────────

function applyStateBrackets(brackets: StateBracket[], income: number): number {
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
// Main Calculator
// ─────────────────────────────────────────────────────────────────────────────

// WA capital gains excise tax: 7% on LTCG above $262,000 (2023 threshold)
const WA_CG_RATE = 0.07;
const WA_CG_THRESHOLD = 262_000;

// CA SDI rate (unlimited wage base starting 2024)
const CA_SDI_RATE = 0.011;

export function calculateStateTax(input: StateTaxInput): StateTaxResult {
  const { stateCode, ordinaryIncome, longTermGains, shortTermGains, filingStatus } = input;
  const w2Wages = input.w2Wages ?? ordinaryIncome;
  const cityCode = input.cityCode;

  const config = STATE_CONFIGS[stateCode.toUpperCase()];
  if (!config) {
    return { stateIncomeTax: 0, sdiTax: 0, cityIncomeTax: 0, effectiveRate: 0, ltcgTreatment: "ordinary" };
  }

  // ── WA: no income tax but 7% capital gains excise on LTCG > $262K ──
  if (stateCode.toUpperCase() === "WA") {
    const taxableGains = Math.max(0, longTermGains - WA_CG_THRESHOLD);
    const waCapGainsTax = taxableGains * WA_CG_RATE;
    const cityIncomeTax = cityCode
      ? calculateCityTax({ cityCode, w2Wages, ordinaryIncome, longTermGains, filingStatus })
      : 0;
    const totalIncome = ordinaryIncome + shortTermGains + longTermGains;
    return {
      stateIncomeTax: waCapGainsTax,
      sdiTax: 0,
      cityIncomeTax,
      effectiveRate: totalIncome > 0 ? (waCapGainsTax + cityIncomeTax) / totalIncome : 0,
      ltcgTreatment: "ordinary",
    };
  }

  if (config.type === "none") {
    const cityIncomeTax = cityCode
      ? calculateCityTax({ cityCode, w2Wages, ordinaryIncome, longTermGains, filingStatus })
      : 0;
    return { stateIncomeTax: 0, sdiTax: 0, cityIncomeTax, effectiveRate: 0, ltcgTreatment: "exempt" };
  }

  // ── CA SDI: 1.1% on all W-2 wages (no wage cap since 2024) ──
  const sdiTax = stateCode.toUpperCase() === "CA"
    ? Math.max(0, w2Wages) * CA_SDI_RATE
    : 0;

  // Compute adjusted long-term gains based on state LTCG treatment
  let taxableLtcg = longTermGains;
  if (config.ltcgTreatment === "preferential") {
    if (config.ltcgRate !== undefined) {
      taxableLtcg = 0; // exclude from ordinary income calculation; handled separately below
    } else if (config.ltcgExclusionPct !== undefined) {
      taxableLtcg = longTermGains * (1 - config.ltcgExclusionPct);
    }
  }

  // States with a special short-term gains rate (e.g. MA 8.5%) exclude STG
  // from the ordinary bracket calculation and tax them at the special rate instead.
  const effectiveShortTerm = config.shortTermGainsRate !== undefined ? 0 : shortTermGains;
  const totalTaxableIncome = ordinaryIncome + effectiveShortTerm + taxableLtcg;

  let stateTax = 0;
  if (config.type === "flat_rate" && config.flatRate !== undefined) {
    stateTax = totalTaxableIncome * config.flatRate;
  } else if (config.type === "brackets" && config.brackets) {
    stateTax = applyStateBrackets(config.brackets[filingStatus], totalTaxableIncome);
  }

  if (config.ltcgTreatment === "preferential" && config.ltcgRate !== undefined) {
    stateTax += longTermGains * config.ltcgRate;
  }

  // Add short-term gains at the special state rate (e.g. MA Part A income at 8.5%)
  if (config.shortTermGainsRate !== undefined && shortTermGains > 0) {
    stateTax += shortTermGains * config.shortTermGainsRate;
  }

  // ── City / local income tax ──
  const cityIncomeTax = cityCode
    ? calculateCityTax({ cityCode, w2Wages, ordinaryIncome, longTermGains, filingStatus })
    : 0;

  const totalIncome = ordinaryIncome + shortTermGains + longTermGains;
  const effectiveRate = totalIncome > 0
    ? (stateTax + sdiTax + cityIncomeTax) / totalIncome
    : 0;

  return {
    stateIncomeTax: stateTax,
    sdiTax,
    cityIncomeTax,
    effectiveRate,
    ltcgTreatment: config.ltcgTreatment,
  };
}

export function getStateLtcgTreatment(stateCode: string): {
  treatment: "ordinary" | "preferential" | "exempt";
  notes?: string;
} {
  const config = STATE_CONFIGS[stateCode.toUpperCase()];
  if (!config) return { treatment: "ordinary" };
  return { treatment: config.ltcgTreatment, notes: config.notes };
}

export { STATE_CONFIGS };
