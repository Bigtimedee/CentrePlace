import { describe, it, expect } from "vitest";
import { calculateEstate } from "../calculator";
import { generateRecommendations } from "../recommendations";
import type { EstateCalcInput } from "../calculator";

// ── Helpers ───────────────────────────────────────────────────────────────────

const currentYear = 2026;

function makeInput(overrides: Partial<EstateCalcInput> = {}): EstateCalcInput {
  return {
    profile: {
      filingStatus: "single",
      stateOfResidence: "CA",
      birthYear: 1970,
    },
    children: [],
    investmentAccounts: [],
    realEstate: [],
    insurance: [],
    carry: [],
    lpInvestments: [],
    currentYear,
    ...overrides,
  };
}

function recs(input: Partial<EstateCalcInput> = {}) {
  const result = calculateEstate(makeInput(input));
  return generateRecommendations(result);
}

function recIds(input: Partial<EstateCalcInput> = {}) {
  return recs(input).map(r => r.id);
}

function findRec(input: Partial<EstateCalcInput>, id: string) {
  return recs(input).find(r => r.id === id);
}

// ── Rule 1: ILIT Conversion ───────────────────────────────────────────────────

describe("ILIT Conversion rule", () => {
  it("does NOT trigger when estate is > $2M below federal exemption and personal policy < $500k", () => {
    // Estate $3M, personal policy $300k — well below $7.18M exemption by $4.18M
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 3_000_000 },
      ],
      insurance: [
        {
          id: "p1",
          policyName: "Term",
          policyType: "term_life",
          ownershipStructure: "personal",
          deathBenefit: 300_000,
          outstandingLoanBalance: 0,
        },
      ],
    });
    expect(ids).not.toContain("ilit-conversion");
  });

  it("does NOT trigger when estate is > $2M below exemption even with large personal policy", () => {
    // Single: $3M estate, $2M personal policy → $3M < ($7.18M - $2M) = $5.18M threshold
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 3_000_000 },
      ],
      insurance: [
        {
          id: "p1",
          policyName: "WL",
          policyType: "whole_life",
          ownershipStructure: "personal",
          deathBenefit: 2_000_000,
          outstandingLoanBalance: 0,
        },
      ],
    });
    expect(ids).not.toContain("ilit-conversion");
  });

  it("triggers when estate is above the federal exemption and personal policy > $500k", () => {
    // Single: $16M estate, $3M personal policy → above $15M exemption
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 16_000_000 },
      ],
      insurance: [
        {
          id: "p1",
          policyName: "WL",
          policyType: "whole_life",
          ownershipStructure: "personal",
          deathBenefit: 3_000_000,
          outstandingLoanBalance: 0,
        },
      ],
    });
    expect(ids).toContain("ilit-conversion");
  });

  it("priority is 'high' when estate is already above exemption", () => {
    const rec = findRec(
      {
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 14_000_000 },
        ],
        insurance: [
          {
            id: "p1",
            policyName: "WL",
            policyType: "whole_life",
            ownershipStructure: "personal",
            deathBenefit: 2_000_000,
            outstandingLoanBalance: 0,
          },
        ],
      },
      "ilit-conversion",
    );
    expect(rec).toBeDefined();
    expect(rec!.priority).toBe("high");
  });

  it("priority is 'medium' when estate is within $2M below the exemption", () => {
    // Single: $13.5M accounts + $0.8M personal policy = $14.3M gross estate
    // $15M − $14.3M = $0.7M below exemption (within $2M threshold) → "medium"
    const rec = findRec(
      {
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 13_500_000 },
        ],
        insurance: [
          {
            id: "p1",
            policyName: "WL",
            policyType: "whole_life",
            ownershipStructure: "personal",
            deathBenefit: 800_000,
            outstandingLoanBalance: 0,
          },
        ],
      },
      "ilit-conversion",
    );
    expect(rec).toBeDefined();
    expect(rec!.priority).toBe("medium");
  });

  it("estimatedTaxSavings is positive and matches counterfactual calculation", () => {
    // $15M estate with $3M personal policy — saving = tax($18M) - tax($15M ILIT)
    const rec = findRec(
      {
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 15_000_000 },
        ],
        insurance: [
          {
            id: "p1",
            policyName: "WL",
            policyType: "whole_life",
            ownershipStructure: "personal",
            deathBenefit: 3_000_000,
            outstandingLoanBalance: 0,
          },
        ],
      },
      "ilit-conversion",
    );
    expect(rec).toBeDefined();
    expect(rec!.estimatedTaxSavings).toBeGreaterThan(0);
    // Tax($18M) - Tax($15M with $3M ILIT excluded) = ($18M-$15M)×40% - 0 = $1.2M
    expect(rec!.estimatedTaxSavings).toBeCloseTo(1_200_000, -4);
  });
});

// ── Rule 2: Annual Gifting ────────────────────────────────────────────────────

describe("Annual Gifting rule", () => {
  it("is always present, even when estate is below exemption", () => {
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 2_000_000 },
      ],
    });
    expect(ids).toContain("annual-gifting");
  });

  it("priority is 'low' when estate is below the federal exemption", () => {
    const rec = findRec(
      {
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 2_000_000 },
        ],
      },
      "annual-gifting",
    );
    expect(rec!.priority).toBe("low");
  });

  it("priority is 'high' when estate is > $5M above exemption", () => {
    // $22M estate → $7M above $15M exemption
    const rec = findRec(
      {
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 22_000_000 },
        ],
      },
      "annual-gifting",
    );
    expect(rec!.priority).toBe("high");
  });

  it("annual gift capacity doubles for MFJ filers", () => {
    // MFJ, 2 children: $19k × 2 children × 2 spouses = $76k/yr
    const rec = findRec(
      {
        profile: {
          filingStatus: "married_filing_jointly",
          stateOfResidence: "CA",
          birthYear: 1970,
        },
        children: [
          { id: "c1", name: "Alice", birthYear: 2000, inheritancePct: 0.5 },
          { id: "c2", name: "Bob",   birthYear: 2002, inheritancePct: 0.5 },
        ],
      },
      "annual-gifting",
    );
    expect(rec).toBeDefined();
    const annualCapFigure = rec!.supportingFigures?.find(
      f => f.label === "Annual gift capacity",
    );
    expect(annualCapFigure).toBeDefined();
    // $76K = $76,000
    expect(annualCapFigure!.value).toBe("$76K");
  });

  it("includes 'Years to gift below threshold' when estate is above exemption", () => {
    // Single, 1 child: $19k/yr. Estate $20M, exemption $15M → $5M excess
    const rec = findRec(
      {
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 20_000_000 },
        ],
        children: [
          { id: "c1", name: "Alice", birthYear: 2000, inheritancePct: 1.0 },
        ],
      },
      "annual-gifting",
    );
    const yearsFig = rec!.supportingFigures?.find(
      f => f.label === "Years to gift below threshold",
    );
    expect(yearsFig).toBeDefined();
    expect(yearsFig!.value).toMatch(/\d+ yrs/);
  });
});

// ── Rule 3: Marital Deduction ─────────────────────────────────────────────────

describe("Marital Deduction rule", () => {
  it("does NOT trigger for single filers", () => {
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 20_000_000 },
      ],
    });
    expect(ids).not.toContain("marital-deduction");
  });

  it("does NOT trigger for MFJ when estate <= combined exemption ($30M)", () => {
    const ids = recIds({
      profile: {
        filingStatus: "married_filing_jointly",
        stateOfResidence: "CA",
        birthYear: 1970,
      },
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 12_000_000 },
      ],
    });
    expect(ids).not.toContain("marital-deduction");
  });

  it("triggers for MFJ when estate > combined exemption", () => {
    const ids = recIds({
      profile: {
        filingStatus: "married_filing_jointly",
        stateOfResidence: "CA",
        birthYear: 1970,
      },
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 35_000_000 },
      ],
    });
    expect(ids).toContain("marital-deduction");
  });

  it("estimatedTaxSavings is 0 (deferral, not permanent reduction)", () => {
    const rec = findRec(
      {
        profile: {
          filingStatus: "married_filing_jointly",
          stateOfResidence: "CA",
          birthYear: 1970,
        },
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 35_000_000 },
        ],
      },
      "marital-deduction",
    );
    expect(rec).toBeDefined();
    expect(rec!.estimatedTaxSavings).toBe(0);
  });
});

// ── Rule 4: Portability Election ──────────────────────────────────────────────

describe("Portability Election rule", () => {
  it("triggers for any MFJ filer", () => {
    const ids = recIds({
      profile: {
        filingStatus: "married_filing_jointly",
        stateOfResidence: "CA",
        birthYear: 1970,
      },
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 5_000_000 },
      ],
    });
    expect(ids).toContain("portability-election");
  });

  it("does NOT trigger for single filers", () => {
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 20_000_000 },
      ],
    });
    expect(ids).not.toContain("portability-election");
  });

  it("category is 'portability'", () => {
    const rec = findRec(
      {
        profile: {
          filingStatus: "married_filing_jointly",
          stateOfResidence: "CA",
          birthYear: 1970,
        },
      },
      "portability-election",
    );
    expect(rec!.category).toBe("portability");
  });

  it("estimatedTaxSavings is 0 (future preservation, not current savings)", () => {
    const rec = findRec(
      {
        profile: {
          filingStatus: "married_filing_jointly",
          stateOfResidence: "CA",
          birthYear: 1970,
        },
      },
      "portability-election",
    );
    expect(rec!.estimatedTaxSavings).toBe(0);
  });
});

// ── Rule 5: Charitable Giving ─────────────────────────────────────────────────

describe("Charitable Giving rule", () => {
  it("does NOT trigger when excess above exemption is < $3M", () => {
    // Estate $9M → $1.82M above $7.18M exemption
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 9_000_000 },
      ],
    });
    expect(ids).not.toContain("charitable-giving");
  });

  it("triggers when excess is >= $3M", () => {
    // Estate $20M → $5M above $15M exemption
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 20_000_000 },
      ],
    });
    expect(ids).toContain("charitable-giving");
  });

  it("estimatedTaxSavings is positive", () => {
    const rec = findRec(
      {
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 20_000_000 },
        ],
      },
      "charitable-giving",
    );
    expect(rec!.estimatedTaxSavings).toBeGreaterThan(0);
  });
});

// ── Rule 6: LLC Discount ──────────────────────────────────────────────────────

describe("LLC Discount rule", () => {
  it("does NOT trigger when real estate is already LLC-discounted", () => {
    // llcValuationDiscountPct > 0 → notes contain "discounted" → rule skips
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 8_000_000 },
      ],
      realEstate: [
        {
          id: "re1",
          propertyName: "LLC Property",
          currentValue: 3_000_000,
          ownershipPct: 1.0,
          llcValuationDiscountPct: 0.25,
          mortgage: null,
        },
      ],
    });
    expect(ids).not.toContain("llc-discount");
  });

  it("does NOT trigger when undiscounted real estate is < $1M", () => {
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 8_000_000 },
      ],
      realEstate: [
        {
          id: "re1",
          propertyName: "Small Rental",
          currentValue: 800_000,
          ownershipPct: 1.0,
          llcValuationDiscountPct: 0,
          mortgage: null,
        },
      ],
    });
    expect(ids).not.toContain("llc-discount");
  });

  it("triggers when undiscounted real estate > $1M", () => {
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 8_000_000 },
      ],
      realEstate: [
        {
          id: "re1",
          propertyName: "Rental",
          currentValue: 3_000_000,
          ownershipPct: 1.0,
          llcValuationDiscountPct: 0,
          mortgage: null,
        },
      ],
    });
    expect(ids).toContain("llc-discount");
  });
});

// ── Rule 7: Trust Strategies ──────────────────────────────────────────────────

describe("Trust Strategies rule", () => {
  it("does NOT trigger when excess is < $5M above exemption", () => {
    // $10M estate → $2.82M above $7.18M — less than $5M trigger
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 10_000_000 },
      ],
    });
    expect(ids).not.toContain("grat-slat");
  });

  it("triggers when excess is >= $5M above exemption", () => {
    // $22M estate → $7M above $15M exemption
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 22_000_000 },
      ],
    });
    expect(ids).toContain("grat-slat");
  });

  it("estimatedTaxSavings is 0 (quantification not possible without return assumptions)", () => {
    const rec = findRec(
      {
        investmentAccounts: [
          { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 22_000_000 },
        ],
      },
      "grat-slat",
    );
    expect(rec!.estimatedTaxSavings).toBe(0);
  });
});

// ── Rule 8: Qualified Opportunity Zone ───────────────────────────────────────

describe("QOZ rule", () => {
  it("does NOT trigger when carry + LP < $1M", () => {
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 8_000_000 },
      ],
      carry: [
        { id: "c1", fundName: "Fund", expectedGrossCarry: 500_000, haircutPct: 0.20, realizationSchedule: [{ year: 2028, pct: 1.0 }] },
      ],
    });
    expect(ids).not.toContain("qualified-opportunity-zone");
  });

  it("does NOT trigger when estate is < 70% of federal exemption", () => {
    // Net carry = $1.5M × (1 - 0.20) = $1.2M ≥ $1M threshold ✓
    // Gross estate = $1.2M < 70% of $7.18M ($5.026M) → should NOT trigger
    const ids = recIds({
      carry: [
        { id: "c1", fundName: "Fund", expectedGrossCarry: 1_500_000, haircutPct: 0.20, realizationSchedule: [{ year: 2028, pct: 1.0 }] },
      ],
    });
    expect(ids).not.toContain("qualified-opportunity-zone");
  });

  it("triggers when carry + LP >= $1M and estate is near exemption", () => {
    // Estate $8M (above $7.18M) with $4M net carry
    const ids = recIds({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 8_000_000 },
      ],
      carry: [
        { id: "c1", fundName: "Fund", expectedGrossCarry: 5_000_000, haircutPct: 0.20, realizationSchedule: [{ year: 2028, pct: 1.0 }] },
      ],
    });
    expect(ids).toContain("qualified-opportunity-zone");
  });
});

// ── Sorting and overall engine ────────────────────────────────────────────────

describe("recommendation sorting", () => {
  it("high priority items come before medium and low", () => {
    // Above exemption with personal insurance → ilit-conversion should be HIGH
    // Annual gifting will be HIGH too (> $5M excess)
    // QOZ and others will be lower priority
    const allRecs = recs({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 15_000_000 },
      ],
      insurance: [
        {
          id: "p1",
          policyName: "WL",
          policyType: "whole_life",
          ownershipStructure: "personal",
          deathBenefit: 3_000_000,
          outstandingLoanBalance: 0,
        },
      ],
    });

    let lastPriorityOrder = -1;
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    for (const r of allRecs) {
      const order = priorityOrder[r.priority];
      expect(order).toBeGreaterThanOrEqual(lastPriorityOrder);
      lastPriorityOrder = order;
    }
  });

  it("within same priority, higher estimatedTaxSavings comes first", () => {
    const allRecs = recs({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 12_000_000 },
      ],
      insurance: [
        {
          id: "p1",
          policyName: "WL",
          policyType: "whole_life",
          ownershipStructure: "personal",
          deathBenefit: 3_000_000,
          outstandingLoanBalance: 0,
        },
      ],
    });

    // Filter to high priority items only
    const highPriorityRecs = allRecs.filter(r => r.priority === "high");
    for (let i = 1; i < highPriorityRecs.length; i++) {
      expect(highPriorityRecs[i - 1].estimatedTaxSavings).toBeGreaterThanOrEqual(
        highPriorityRecs[i].estimatedTaxSavings,
      );
    }
  });

  it("returns an empty array when no rules trigger", () => {
    // Tiny estate, no insurance, no carry/LP — only annual gifting fires
    const allRecs = recs({
      investmentAccounts: [
        { id: "a1", accountName: "Brokerage", accountType: "taxable", currentBalance: 100_000 },
      ],
    });
    // Should have annual-gifting (always fires) but nothing else
    expect(allRecs.every(r => r.id === "annual-gifting")).toBe(true);
  });
});
