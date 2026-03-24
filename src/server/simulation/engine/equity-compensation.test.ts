import { describe, it, expect } from "vitest";
import { runSimulation } from "./quarterly-engine";
import { calculateFederalTax } from "../tax/federal-income";
import type { SimulationInput, SimEquityGrant } from "./types";

// ── Minimal test helpers ───────────────────────────────────────────────────────

const baseProfile = (): SimulationInput["profile"] => ({
  filingStatus: "single",
  stateOfResidence: "TX", // no state income tax — cleaner assertions
  birthYear: 1981,        // age 45 in 2026
  targetAge: 90,
  assumedReturnRate: 0.07,
  safeHarborElection: true,
  postFIReturnRate: 0.05,
});

const minimalInput = (overrides: Partial<SimulationInput> = {}): SimulationInput => ({
  profile: baseProfile(),
  income: null,
  carry: [],
  lpDistributions: [],
  investmentAccounts: [],
  realEstate: [],
  insurance: [],
  recurringExpenditures: [],
  oneTimeExpenditures: [],
  children: [],
  realizationPolicy: null,
  startYear: 2026,
  ...overrides,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the quarter index (0-based) for a given year and quarter label. */
function quarterIndex(startYear: number, year: number, quarter: "Q1" | "Q2" | "Q3" | "Q4"): number {
  const qOffset = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };
  return (year - startYear) * 4 + qOffset[quarter];
}

// ── Test 1: RSU vesting — ordinary income ─────────────────────────────────────

describe("equity compensation — RSU vesting", () => {
  it("produces equityCompensationIncome = shares × FMV in the vesting quarter", () => {
    const rsuGrant: SimEquityGrant = {
      id: "rsu-1",
      grantType: "rsu",
      companyName: "Acme Corp",
      currentFmv: 50,
      fmvGrowthRate: 0,
      strikePrice: null,
      vestingEvents: [
        {
          year: 2026,
          quarter: "Q1",
          shares: 100,
          projectedFmvAtEvent: 50,
        },
      ],
      shareLots: [],
    };

    const result = runSimulation(minimalInput({ equityGrants: [rsuGrant] }));
    const q1 = result.quarters[0];

    expect(q1.equityCompensationIncome).toBe(5000); // 100 × $50
    expect(q1.isoAmtAdjustment).toBe(0);
    expect(q1.equityLtcgIncome).toBe(0);
  });
});

// ── Test 2: ISO exercise — AMT adjustment, not ordinary income ────────────────

describe("equity compensation — ISO exercise", () => {
  it("produces isoAmtAdjustment = shares × (FMV − strikePrice) with zero equityCompensationIncome", () => {
    const isoGrant: SimEquityGrant = {
      id: "iso-1",
      grantType: "iso",
      companyName: "Acme Corp",
      currentFmv: 60,
      fmvGrowthRate: 0,
      strikePrice: 10,
      vestingEvents: [
        {
          year: 2026,
          quarter: "Q1",
          shares: 100,
          projectedFmvAtEvent: 60,
        },
      ],
      shareLots: [],
    };

    const result = runSimulation(minimalInput({ equityGrants: [isoGrant] }));
    const q1 = result.quarters[0];

    // ISO spread: 100 × (60 − 10) = 5000
    expect(q1.isoAmtAdjustment).toBe(5000);
    // ISO exercise does not produce ordinary income
    expect(q1.equityCompensationIncome).toBe(0);
    expect(q1.equityLtcgIncome).toBe(0);
  });
});

// ── Test 3: NSO exercise — ordinary income ────────────────────────────────────

describe("equity compensation — NSO exercise", () => {
  it("produces equityCompensationIncome = shares × FMV in the exercise quarter", () => {
    // The engine uses shares × FMV (not shares × spread) for NSO/RSU/Warrant/RSA
    // ordinary income recognition.
    const nsoGrant: SimEquityGrant = {
      id: "nso-1",
      grantType: "nso",
      companyName: "Acme Corp",
      currentFmv: 40,
      fmvGrowthRate: 0,
      strikePrice: 15,
      vestingEvents: [
        {
          year: 2026,
          quarter: "Q2",
          shares: 200,
          projectedFmvAtEvent: 40,
        },
      ],
      shareLots: [],
    };

    const result = runSimulation(minimalInput({ equityGrants: [nsoGrant] }));
    const q2 = result.quarters[1];

    // Engine: equityOrdinaryIncome += shares × fmv = 200 × 40 = 8000
    expect(q2.equityCompensationIncome).toBe(8000);
    expect(q2.isoAmtAdjustment).toBe(0);
    expect(q2.equityLtcgIncome).toBe(0);
  });
});

// ── Test 4: Share lot LTCG sale ───────────────────────────────────────────────

describe("equity compensation — share lot LTCG sale", () => {
  it("produces equityLtcgIncome = shares × (saleFMV − costBasis) in the sale quarter", () => {
    // Sale in year 2 (2027) Q3; cost basis $20/share; projected FMV in year 2 = $50
    // (currentFmv = 50, fmvGrowthRate = 0 → FMV stays at 50)
    const grant: SimEquityGrant = {
      id: "lot-1",
      grantType: "rsu",
      companyName: "Acme Corp",
      currentFmv: 50,
      fmvGrowthRate: 0,
      strikePrice: null,
      vestingEvents: [],
      shareLots: [
        {
          shares: 50,
          costBasisPerShare: 20,
          acquiredDate: "2024-01-01",
          projectedSaleYear: 2027,
          projectedSaleQuarter: "Q3",
          isIsoQualifying: false,
        },
      ],
    };

    const result = runSimulation(minimalInput({ equityGrants: [grant] }));
    const idx = quarterIndex(2026, 2027, "Q3");
    const q = result.quarters[idx];

    // LTCG = 50 × (50 − 20) = 1500
    expect(q.equityLtcgIncome).toBe(1500);
    expect(q.equityCompensationIncome).toBe(0);
    expect(q.isoAmtAdjustment).toBe(0);
  });
});

// ── Test 5: AMT calculation — ISO creates positive AMT liability ──────────────

describe("AMT calculation — ISO spread triggers AMT", () => {
  it("produces amt > 0 matching tentativeMinimumTax − regularTax when ISO spread is large", () => {
    // Ordinary income = $80,000 (moderate); ISO spread = $500,000
    // taxableOrdinary = 80,000 − 8,300 (standard deduction) = 71,700
    // AMTI = 71,700 + 500,000 = 571,700
    // tentativeMinimumTax = (571,700 − 85,700) × 0.26 = 486,000 × 0.26 = 126,360
    // regularTax = applyBrackets(71,700) — well below 126,360 → AMT > 0
    const result = calculateFederalTax({
      ordinaryIncome: 80_000,
      qualifiedDividends: 0,
      longTermGains: 0,
      unrecaptured1250Gain: 0,
      agi: 80_000,
      filingStatus: "single",
      year: 2026,
      isoAmtAdjustment: 500_000,
    });

    const standardDeduction = 8_300;
    const taxableOrdinary = 80_000 - standardDeduction;
    const amti = taxableOrdinary + 500_000;
    const tentativeMinimumTax = Math.max(0, amti - 85_700) * 0.26;
    // regularTax: applyBrackets on 71,700 single 2026
    // 10% on 11,925 = 1,192.5
    // 15% on (48,475 − 11,925) = 15% × 36,550 = 5,482.5
    // 25% on (71,700 − 48,475) = 25% × 23,225 = 5,806.25
    const expectedOrdinaryTax = 11_925 * 0.10 + (48_475 - 11_925) * 0.15 + (taxableOrdinary - 48_475) * 0.25;
    const expectedAmt = Math.max(0, tentativeMinimumTax - expectedOrdinaryTax);

    expect(result.amt).toBeGreaterThan(0);
    expect(result.amt).toBeCloseTo(expectedAmt, 0);
  });
});

// ── Test 6: AMT = 0 when regular tax exceeds tentative minimum ────────────────

describe("AMT calculation — regular tax exceeds tentative minimum", () => {
  it("produces amt = 0 when ordinary income is very high relative to ISO spread", () => {
    // Very high ordinary income ($2,000,000) → regular tax far exceeds any tentative minimum
    // even with a modest ISO adjustment
    const result = calculateFederalTax({
      ordinaryIncome: 2_000_000,
      qualifiedDividends: 0,
      longTermGains: 0,
      unrecaptured1250Gain: 0,
      agi: 2_000_000,
      filingStatus: "single",
      year: 2026,
      isoAmtAdjustment: 10_000,
    });

    expect(result.amt).toBe(0);
  });
});

// ── Test 7: FMV auto-projection from currentFmv and fmvGrowthRate ─────────────

describe("equity compensation — FMV auto-projection", () => {
  it("uses currentFmv × (1 + rate)^yearsAhead when projectedFmvAtEvent is null", () => {
    // currentFmv = 100, fmvGrowthRate = 0.10, vesting in year 3 (2028) Q1
    // yearsAhead = 2028 − 2026 = 2  (startYear is 2026)
    // projected FMV = 100 × 1.1^2 = 121
    // RSU income = 100 shares × 121 = 12100
    const grant: SimEquityGrant = {
      id: "proj-1",
      grantType: "rsu",
      companyName: "TestCo",
      currentFmv: 100,
      fmvGrowthRate: 0.10,
      strikePrice: null,
      vestingEvents: [
        {
          year: 2028,
          quarter: "Q1",
          shares: 100,
          projectedFmvAtEvent: null, // engine must project
        },
      ],
      shareLots: [],
    };

    const result = runSimulation(minimalInput({ equityGrants: [grant] }));
    const idx = quarterIndex(2026, 2028, "Q1");
    const q = result.quarters[idx];

    // yearsAhead = 2028 - 2026 = 2; FMV = 100 × 1.1^2 = 121
    const projectedFmv = 100 * Math.pow(1.1, 2);
    const expectedIncome = 100 * projectedFmv;

    expect(q.equityCompensationIncome).toBeCloseTo(expectedIncome, 2);
  });
});

// ── Test 8: Multi-grant aggregation in a single quarter ───────────────────────

describe("equity compensation — multi-grant aggregation", () => {
  it("sums equityCompensationIncome across RSU and NSO grants vesting the same quarter", () => {
    // RSU: 100 shares × $50 FMV = $5,000 ordinary income
    // NSO: 200 shares × $40 FMV = $8,000 ordinary income (engine uses shares × FMV for NSO)
    // Total equityCompensationIncome = $13,000
    const rsuGrant: SimEquityGrant = {
      id: "rsu-multi",
      grantType: "rsu",
      companyName: "Co A",
      currentFmv: 50,
      fmvGrowthRate: 0,
      strikePrice: null,
      vestingEvents: [
        {
          year: 2026,
          quarter: "Q1",
          shares: 100,
          projectedFmvAtEvent: 50,
        },
      ],
      shareLots: [],
    };

    const nsoGrant: SimEquityGrant = {
      id: "nso-multi",
      grantType: "nso",
      companyName: "Co B",
      currentFmv: 40,
      fmvGrowthRate: 0,
      strikePrice: 15,
      vestingEvents: [
        {
          year: 2026,
          quarter: "Q1",
          shares: 200,
          projectedFmvAtEvent: 40,
        },
      ],
      shareLots: [],
    };

    const result = runSimulation(minimalInput({ equityGrants: [rsuGrant, nsoGrant] }));
    const q1 = result.quarters[0];

    // RSU: 100 × 50 = 5,000; NSO: 200 × 40 = 8,000; total = 13,000
    expect(q1.equityCompensationIncome).toBe(13_000);
    expect(q1.isoAmtAdjustment).toBe(0);
    expect(q1.equityLtcgIncome).toBe(0);
  });
});

// ── Test 9: No equity grants — all equity fields are zero ─────────────────────

describe("equity compensation — no grants", () => {
  it("runs without error and all equity fields are zero when equityGrants is omitted", () => {
    const result = runSimulation(minimalInput());

    expect(result.quarters).toHaveLength(160);

    for (const q of result.quarters) {
      expect(q.equityCompensationIncome).toBe(0);
      expect(q.isoAmtAdjustment).toBe(0);
      expect(q.equityLtcgIncome).toBe(0);
    }
  });

  it("runs without error and all equity fields are zero when equityGrants is an empty array", () => {
    const result = runSimulation(minimalInput({ equityGrants: [] }));

    expect(result.quarters).toHaveLength(160);

    for (const q of result.quarters) {
      expect(q.equityCompensationIncome).toBe(0);
      expect(q.isoAmtAdjustment).toBe(0);
      expect(q.equityLtcgIncome).toBe(0);
    }
  });
});
