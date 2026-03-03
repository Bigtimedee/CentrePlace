// ─────────────────────────────────────────────────────────────────────────────
// Estate Tax Engine — Federal + State
// ─────────────────────────────────────────────────────────────────────────────
//
// Federal:
//   2026 = TCJA sunset. The TCJA doubled the basic exclusion amount through 2025.
//   In 2026, the exemption reverts to pre-TCJA law (~$7M inflated), unless
//   Congress acts. This engine models the sunset (i.e., lower exemption) by
//   default, which is the conservative planning assumption.
//
//   Federal estate tax rate: 40% flat on taxable estate above the exemption.
//   The Reg. § 20.2010-1(c) anti-clawback rule protects gifts made during
//   the TCJA window — not modeled here (we model the net estate at death only).
//
// State:
//   12 states + DC have their own estate tax.
//   4 states have an inheritance tax (IA, KY, MD*, NE, NJ, PA) — modeled
//   separately as they apply to beneficiaries, not the estate itself.
//   *MD has both estate tax and inheritance tax.

import type { FilingStatus, EstateTaxInput, EstateTaxResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Federal Estate Tax
// ─────────────────────────────────────────────────────────────────────────────

// Post-TCJA-sunset 2026 exemption (approximate; will be inflation-adjusted).
// Base pre-TCJA amount was $5M (2010 dollars) inflated to ~$7.18M for 2026.
const FEDERAL_EXEMPTION_2026 = 7_180_000;
const FEDERAL_EXEMPTION_MFJ_2026 = FEDERAL_EXEMPTION_2026 * 2; // portability
const FEDERAL_ESTATE_RATE = 0.40;

// ─────────────────────────────────────────────────────────────────────────────
// State Estate Tax Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface StateEstateConfig {
  hasEstateTax: boolean;
  exemption: number;         // State exemption amount
  topRate: number;           // Top marginal rate
  brackets?: { upTo: number; rate: number }[]; // Progressive brackets (cumulative from exemption)
  notes?: string;
}

const STATE_ESTATE_CONFIGS: Record<string, StateEstateConfig> = {
  // ── Connecticut — Only state with a gift+estate tax ───────────────────────
  CT: {
    hasEstateTax: true,
    exemption: 13_610_000, // CT matched federal TCJA exemption; will drop in 2026
    topRate: 0.12,
    brackets: [
      { upTo: 1_000_000,  rate: 0.10 },
      { upTo: 5_000_000,  rate: 0.11 },
      { upTo: Infinity,   rate: 0.12 },
    ],
    notes: "CT exemption likely reverts to ~$3.6M at federal sunset",
  },

  // ── Hawaii ────────────────────────────────────────────────────────────────
  HI: {
    hasEstateTax: true,
    exemption: 5_490_000,
    topRate: 0.20,
    brackets: [
      { upTo: 1_000_000,  rate: 0.10 },
      { upTo: 2_000_000,  rate: 0.11 },
      { upTo: 5_000_000,  rate: 0.15 },
      { upTo: 10_000_000, rate: 0.20 },
      { upTo: Infinity,   rate: 0.20 },
    ],
  },

  // ── Illinois ──────────────────────────────────────────────────────────────
  IL: {
    hasEstateTax: true,
    exemption: 4_000_000,
    topRate: 0.16,
    brackets: [
      { upTo: 1_000_000,  rate: 0.08 },
      { upTo: 2_000_000,  rate: 0.10 },
      { upTo: 3_000_000,  rate: 0.12 },
      { upTo: Infinity,   rate: 0.16 },
    ],
  },

  // ── Maine ─────────────────────────────────────────────────────────────────
  ME: {
    hasEstateTax: true,
    exemption: 6_800_000,
    topRate: 0.12,
    brackets: [
      { upTo: 1_000_000, rate: 0.08 },
      { upTo: 2_000_000, rate: 0.10 },
      { upTo: Infinity,  rate: 0.12 },
    ],
  },

  // ── Maryland ──────────────────────────────────────────────────────────────
  MD: {
    hasEstateTax: true,
    exemption: 5_000_000,
    topRate: 0.16,
    brackets: [
      { upTo: 1_000_000, rate: 0.10 },
      { upTo: 2_000_000, rate: 0.12 },
      { upTo: 3_000_000, rate: 0.14 },
      { upTo: Infinity,  rate: 0.16 },
    ],
    notes: "MD also has inheritance tax (10% on non-exempt heirs) — separate calculation",
  },

  // ── Massachusetts ─────────────────────────────────────────────────────────
  MA: {
    hasEstateTax: true,
    exemption: 2_000_000,
    topRate: 0.16,
    brackets: [
      { upTo: 1_000_000,  rate: 0.08 },
      { upTo: 2_000_000,  rate: 0.10 },
      { upTo: 4_000_000,  rate: 0.12 },
      { upTo: 6_000_000,  rate: 0.14 },
      { upTo: 10_000_000, rate: 0.16 },
      { upTo: Infinity,   rate: 0.16 },
    ],
    notes: "MA uses a cliff exemption — if estate > $2M, entire estate is taxable",
  },

  // ── Minnesota ─────────────────────────────────────────────────────────────
  MN: {
    hasEstateTax: true,
    exemption: 3_000_000,
    topRate: 0.16,
    brackets: [
      { upTo: 700_000,   rate: 0.10 },
      { upTo: 2_100_000, rate: 0.12 },
      { upTo: 5_300_000, rate: 0.13 },
      { upTo: 8_500_000, rate: 0.14 },
      { upTo: 11_700_000, rate: 0.15 },
      { upTo: Infinity,  rate: 0.16 },
    ],
  },

  // ── New York ──────────────────────────────────────────────────────────────
  NY: {
    hasEstateTax: true,
    exemption: 7_160_000,
    topRate: 0.16,
    brackets: [
      { upTo: 500_000,   rate: 0.03 },
      { upTo: 1_000_000, rate: 0.05 },
      { upTo: 1_500_000, rate: 0.07 },
      { upTo: 2_100_000, rate: 0.08 },
      { upTo: 2_600_000, rate: 0.08 },
      { upTo: 3_100_000, rate: 0.095 },
      { upTo: 3_600_000, rate: 0.105 },
      { upTo: 4_100_000, rate: 0.11 },
      { upTo: 5_100_000, rate: 0.12 },
      { upTo: 6_100_000, rate: 0.125 },
      { upTo: 7_100_000, rate: 0.13 },
      { upTo: 8_100_000, rate: 0.145 },
      { upTo: 9_100_000, rate: 0.16 },
      { upTo: Infinity,  rate: 0.16 },
    ],
    notes: "NY 'cliff' at 105% of exemption — if estate > 105% of exemption, full estate taxed at NY rates (no exemption)",
  },

  // ── Oregon ────────────────────────────────────────────────────────────────
  OR: {
    hasEstateTax: true,
    exemption: 1_000_000,
    topRate: 0.16,
    brackets: [
      { upTo: 1_000_000, rate: 0.10 },
      { upTo: 2_000_000, rate: 0.10 },
      { upTo: 4_000_000, rate: 0.12 },
      { upTo: 6_000_000, rate: 0.13 },
      { upTo: 7_000_000, rate: 0.14 },
      { upTo: 8_000_000, rate: 0.14 },
      { upTo: 9_000_000, rate: 0.15 },
      { upTo: Infinity,  rate: 0.16 },
    ],
  },

  // ── Rhode Island ──────────────────────────────────────────────────────────
  RI: {
    hasEstateTax: true,
    exemption: 1_733_264,
    topRate: 0.16,
    brackets: [
      { upTo: 1_000_000,  rate: 0.06 },
      { upTo: 2_000_000,  rate: 0.07 },
      { upTo: 3_000_000,  rate: 0.08 },
      { upTo: 4_000_000,  rate: 0.09 },
      { upTo: 5_000_000,  rate: 0.10 },
      { upTo: 6_000_000,  rate: 0.11 },
      { upTo: 7_000_000,  rate: 0.12 },
      { upTo: 8_000_000,  rate: 0.13 },
      { upTo: 9_000_000,  rate: 0.14 },
      { upTo: 10_000_000, rate: 0.15 },
      { upTo: Infinity,   rate: 0.16 },
    ],
  },

  // ── Vermont ───────────────────────────────────────────────────────────────
  VT: {
    hasEstateTax: true,
    exemption: 5_000_000,
    topRate: 0.16,
    brackets: [
      { upTo: Infinity, rate: 0.16 },
    ],
    notes: "VT flat 16% on taxable estate above exemption",
  },

  // ── Washington ────────────────────────────────────────────────────────────
  WA: {
    hasEstateTax: true,
    exemption: 2_193_000,
    topRate: 0.20,
    brackets: [
      { upTo: 1_000_000,  rate: 0.10 },
      { upTo: 2_000_000,  rate: 0.14 },
      { upTo: 3_000_000,  rate: 0.15 },
      { upTo: 4_000_000,  rate: 0.16 },
      { upTo: 6_000_000,  rate: 0.18 },
      { upTo: 7_000_000,  rate: 0.19 },
      { upTo: Infinity,   rate: 0.20 },
    ],
  },

  // ── District of Columbia ──────────────────────────────────────────────────
  DC: {
    hasEstateTax: true,
    exemption: 4_711_000,
    topRate: 0.16,
    brackets: [
      { upTo: 1_000_000, rate: 0.08 },
      { upTo: 2_000_000, rate: 0.10 },
      { upTo: 3_000_000, rate: 0.12 },
      { upTo: 4_000_000, rate: 0.14 },
      { upTo: Infinity,  rate: 0.16 },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function calcFederalEstateTax(
  taxableEstate: number,
  filingStatus: FilingStatus
): number {
  // Federal: 40% flat above exemption
  const exemption =
    filingStatus === "married_filing_jointly"
      ? FEDERAL_EXEMPTION_MFJ_2026
      : FEDERAL_EXEMPTION_2026;
  const above = Math.max(0, taxableEstate - exemption);
  return above * FEDERAL_ESTATE_RATE;
}

function calcStateEstateTax(
  grossEstate: number,
  stateCode: string,
  filingStatus: FilingStatus
): number {
  const config = STATE_ESTATE_CONFIGS[stateCode.toUpperCase()];
  if (!config?.hasEstateTax) return 0;

  // Special handling for MA cliff exemption
  const isMaCliff = stateCode.toUpperCase() === "MA";
  const isNyCliff = stateCode.toUpperCase() === "NY";

  // NY cliff: if estate > 105% of NY exemption, no exemption at all
  let taxableEstate: number;
  if (isNyCliff && grossEstate > config.exemption * 1.05) {
    taxableEstate = grossEstate; // full estate taxable
  } else if (isMaCliff && grossEstate > config.exemption) {
    taxableEstate = grossEstate; // full estate taxable
  } else {
    taxableEstate = Math.max(0, grossEstate - config.exemption);
  }

  if (taxableEstate <= 0) return 0;

  if (!config.brackets || config.brackets.length === 0) {
    return taxableEstate * config.topRate;
  }

  // Progressive brackets applied to taxable estate (above 0, not above exemption,
  // for states that use cliff exemptions or bracket tables starting at 0)
  let tax = 0;
  let prev = 0;
  for (const bracket of config.brackets) {
    if (taxableEstate <= prev) break;
    const slice = Math.min(taxableEstate, bracket.upTo) - prev;
    tax += slice * bracket.rate;
    prev = bracket.upTo;
    if (bracket.upTo === Infinity) break;
  }
  return tax;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Calculator
// ─────────────────────────────────────────────────────────────────────────────

export function calculateEstateTax(input: EstateTaxInput): EstateTaxResult {
  const {
    grossEstate,
    ilitDeathBenefit,
    charitableDeductions,
    maritalDeduction,
    stateCode,
    filingStatus,
  } = input;

  // Net estate excludes ILIT death benefit (not part of taxable estate)
  const netEstateBeforeTax = grossEstate - ilitDeathBenefit;

  // Federal taxable estate = gross - ILIT - charitable - marital
  const federalTaxableEstate = Math.max(
    0,
    netEstateBeforeTax - charitableDeductions - maritalDeduction
  );

  const federalEstateTax = calcFederalEstateTax(federalTaxableEstate, filingStatus);
  const stateEstateTax = calcStateEstateTax(netEstateBeforeTax, stateCode, filingStatus);

  const totalEstateTax = federalEstateTax + stateEstateTax;

  return {
    federalTaxableEstate,
    federalEstateTax,
    stateEstateTax,
    totalEstateTax,
    netEstate: grossEstate - ilitDeathBenefit - totalEstateTax,
  };
}

export function hasStateEstateTax(stateCode: string): boolean {
  return STATE_ESTATE_CONFIGS[stateCode.toUpperCase()]?.hasEstateTax ?? false;
}

export function getStateEstateExemption(stateCode: string): number {
  return STATE_ESTATE_CONFIGS[stateCode.toUpperCase()]?.exemption ?? 0;
}

export { STATE_ESTATE_CONFIGS, FEDERAL_EXEMPTION_2026 };
