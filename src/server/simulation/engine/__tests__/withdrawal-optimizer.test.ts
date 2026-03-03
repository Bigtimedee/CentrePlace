import { describe, it, expect } from "vitest";
import { optimizeWithdrawals } from "../withdrawal-optimizer";
import type { WithdrawalOptimizerInput } from "../withdrawal-optimizer";

// ── Test helpers ──────────────────────────────────────────────────────────────

const base = (overrides: Partial<WithdrawalOptimizerInput> = {}): WithdrawalOptimizerInput => ({
  annualSpendingNeed: 200_000,
  existingOrdinaryIncome: 0,
  accounts: [],
  insurance: [],
  filingStatus: "single",
  stateCode: "TX", // no state tax → simpler assertions
  age: 60,
  year: 2026,
  ...overrides,
});

// ── No funds available ────────────────────────────────────────────────────────

describe("optimizeWithdrawals — no funds", () => {
  it("returns empty plan when no accounts or insurance", () => {
    const plan = optimizeWithdrawals(base({ annualSpendingNeed: 100_000 }));
    expect(plan.steps).toHaveLength(0);
    expect(plan.totalGross).toBe(0);
    expect(plan.unmetNeed).toBe(100_000);
  });

  it("unmetNeed equals spending need when funds are zero", () => {
    const plan = optimizeWithdrawals(base());
    expect(plan.unmetNeed).toBe(200_000);
    expect(plan.metNeed).toBe(0);
  });
});

// ── RMD tests ─────────────────────────────────────────────────────────────────

describe("optimizeWithdrawals — RMDs", () => {
  it("no RMD before age 73", () => {
    const plan = optimizeWithdrawals(base({
      age: 72,
      accounts: [{ id: "a1", accountName: "IRA", accountType: "traditional_ira", currentBalance: 1_000_000, costBasisPct: 0 }],
    }));
    expect(plan.rmdAmount).toBe(0);
    expect(plan.steps.every(s => s.sourceType !== "rmd")).toBe(true);
  });

  it("computes RMD at age 73 (factor 26.5)", () => {
    const plan = optimizeWithdrawals(base({
      age: 73,
      annualSpendingNeed: 0, // only care about RMD calculation
      accounts: [{ id: "a1", accountName: "IRA", accountType: "traditional_ira", currentBalance: 265_000, costBasisPct: 0 }],
    }));
    // 265,000 / 26.5 = 10,000
    expect(plan.rmdAmount).toBeCloseTo(10_000, 0);
    expect(plan.steps[0].sourceType).toBe("rmd");
    expect(plan.steps[0].grossAmount).toBeCloseTo(10_000, 0);
  });

  it("RMD step has positive tax cost (taxed as ordinary income)", () => {
    const plan = optimizeWithdrawals(base({
      age: 73,
      annualSpendingNeed: 0,
      accounts: [{ id: "a1", accountName: "IRA", accountType: "traditional_ira", currentBalance: 500_000, costBasisPct: 0 }],
    }));
    const rmdStep = plan.steps.find(s => s.sourceType === "rmd");
    expect(rmdStep).toBeDefined();
    expect(rmdStep!.taxCost).toBeGreaterThan(0);
  });

  it("Roth IRA is not subject to RMD", () => {
    const plan = optimizeWithdrawals(base({
      age: 75,
      annualSpendingNeed: 0,
      accounts: [{ id: "r1", accountName: "Roth IRA", accountType: "roth_ira", currentBalance: 1_000_000, costBasisPct: 0 }],
    }));
    expect(plan.rmdAmount).toBe(0);
    expect(plan.steps.every(s => s.sourceType !== "rmd")).toBe(true);
  });
});

// ── PPLI and whole life loan tests ────────────────────────────────────────────

describe("optimizeWithdrawals — policy loans", () => {
  it("PPLI loan is tax-free", () => {
    const plan = optimizeWithdrawals(base({
      insurance: [{
        id: "ins1",
        policyName: "PPLI Fund",
        policyType: "ppli",
        cashValue: 500_000,
        outstandingLoan: 0,
        maxLoanPct: 0.9,
      }],
    }));
    const ppliStep = plan.steps.find(s => s.sourceType === "ppli_loan");
    expect(ppliStep).toBeDefined();
    expect(ppliStep!.taxCost).toBe(0);
    expect(ppliStep!.federalTaxRate).toBe(0);
    expect(ppliStep!.netAmount).toBe(ppliStep!.grossAmount);
  });

  it("PPLI available loan respects maxLoanPct and existing loan", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 1_000_000,
      insurance: [{
        id: "ins1",
        policyName: "PPLI",
        policyType: "ppli",
        cashValue: 1_000_000,
        outstandingLoan: 500_000, // 500k already borrowed
        maxLoanPct: 0.9,  // max 900k total → 400k available
      }],
    }));
    const ppliStep = plan.steps.find(s => s.sourceType === "ppli_loan");
    expect(ppliStep!.grossAmount).toBeCloseTo(400_000, 0);
  });

  it("whole life loan is tax-free", () => {
    const plan = optimizeWithdrawals(base({
      insurance: [{
        id: "ins1",
        policyName: "WL Policy",
        policyType: "whole_life",
        cashValue: 300_000,
        outstandingLoan: 0,
        maxLoanPct: 0.9,
      }],
    }));
    const wlStep = plan.steps.find(s => s.sourceType === "wl_loan");
    expect(wlStep).toBeDefined();
    expect(wlStep!.taxCost).toBe(0);
  });

  it("PPLI comes before whole life in ranking", () => {
    const plan = optimizeWithdrawals(base({
      insurance: [
        { id: "wl1", policyName: "WL", policyType: "whole_life", cashValue: 200_000, outstandingLoan: 0, maxLoanPct: 0.9 },
        { id: "ppli1", policyName: "PPLI", policyType: "ppli", cashValue: 200_000, outstandingLoan: 0, maxLoanPct: 0.9 },
      ],
    }));
    const ppliRank = plan.steps.find(s => s.sourceType === "ppli_loan")!.rank;
    const wlRank = plan.steps.find(s => s.sourceType === "wl_loan")!.rank;
    expect(ppliRank).toBeLessThan(wlRank);
  });

  it("policy with no available loan is skipped", () => {
    const plan = optimizeWithdrawals(base({
      insurance: [{
        id: "ins1",
        policyName: "Maxed PPLI",
        policyType: "ppli",
        cashValue: 500_000,
        outstandingLoan: 450_000, // already borrowed 90% (maxLoanPct = 0.9)
        maxLoanPct: 0.9,
      }],
    }));
    expect(plan.steps.every(s => s.sourceType !== "ppli_loan")).toBe(true);
  });
});

// ── Taxable account (0% LTCG zone) ───────────────────────────────────────────

describe("optimizeWithdrawals — taxable 0% zone", () => {
  it("taxable gains in 0% zone have zero federal tax", () => {
    // Single: 0% LTCG zone top = $48,350 (taxable income)
    // With existing income = 0 and std deduction = $8,300, can have ~56,650 AGI
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 40_000,
      accounts: [{
        id: "t1",
        accountName: "Schwab",
        accountType: "taxable",
        currentBalance: 200_000,
        costBasisPct: 0.5, // 50% gains
      }],
    }));
    const step0 = plan.steps.find(s => s.sourceType === "taxable_0pct");
    expect(step0).toBeDefined();
    expect(step0!.federalTaxRate).toBe(0);
  });

  it("taxable withdrawal in TX has zero state tax in 0% zone", () => {
    const plan = optimizeWithdrawals(base({
      stateCode: "TX",
      annualSpendingNeed: 40_000,
      accounts: [{ id: "t1", accountName: "Taxable", accountType: "taxable", currentBalance: 200_000, costBasisPct: 0.5 }],
    }));
    const step0 = plan.steps.find(s => s.sourceType === "taxable_0pct");
    expect(step0!.taxCost).toBe(0);
  });

  it("does not use taxable_0pct once LTCG room is exhausted", () => {
    // Large existing income pushes past the 0% LTCG bracket
    const plan = optimizeWithdrawals(base({
      existingOrdinaryIncome: 500_000, // already past all LTCG zero-rate room
      annualSpendingNeed: 50_000,
      accounts: [{ id: "t1", accountName: "Taxable", accountType: "taxable", currentBalance: 500_000, costBasisPct: 0.5 }],
    }));
    expect(plan.steps.every(s => s.sourceType !== "taxable_0pct")).toBe(true);
  });
});

// ── Roth accounts ──────────────────────────────────────────────────────────────

describe("optimizeWithdrawals — Roth", () => {
  it("Roth distribution is tax-free", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 100_000,
      accounts: [{ id: "r1", accountName: "Roth IRA", accountType: "roth_ira", currentBalance: 500_000, costBasisPct: 1 }],
    }));
    const rothStep = plan.steps.find(s => s.sourceType === "roth");
    expect(rothStep).toBeDefined();
    expect(rothStep!.taxCost).toBe(0);
    expect(rothStep!.netAmount).toBe(rothStep!.grossAmount);
  });

  it("Roth 401k also qualifies as tax-free", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 50_000,
      accounts: [{ id: "r1", accountName: "Roth 401k", accountType: "roth_401k", currentBalance: 200_000, costBasisPct: 1 }],
    }));
    expect(plan.steps.some(s => s.sourceType === "roth")).toBe(true);
    expect(plan.steps.find(s => s.sourceType === "roth")!.taxCost).toBe(0);
  });
});

// ── Traditional accounts ──────────────────────────────────────────────────────

describe("optimizeWithdrawals — traditional", () => {
  it("traditional IRA withdrawal is taxed as ordinary income", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 100_000,
      accounts: [{ id: "t1", accountName: "Trad IRA", accountType: "traditional_ira", currentBalance: 1_000_000, costBasisPct: 0 }],
    }));
    const step = plan.steps.find(s => s.sourceType === "traditional");
    expect(step).toBeDefined();
    expect(step!.taxCost).toBeGreaterThan(0);
    expect(step!.federalTaxRate).toBeGreaterThan(0);
  });

  it("traditional 401k, sep_ira, and solo_401k all trigger ordinary income tax", () => {
    for (const accountType of ["traditional_401k", "sep_ira", "solo_401k"]) {
      const plan = optimizeWithdrawals(base({
        annualSpendingNeed: 50_000,
        accounts: [{ id: "a1", accountName: accountType, accountType, currentBalance: 500_000, costBasisPct: 0 }],
      }));
      const step = plan.steps.find(s => s.sourceType === "traditional");
      expect(step, `Expected traditional step for ${accountType}`).toBeDefined();
      expect(step!.taxCost).toBeGreaterThan(0);
    }
  });

  it("CA resident pays more total tax than TX resident (state tax)", () => {
    const txPlan = optimizeWithdrawals(base({
      stateCode: "TX",
      annualSpendingNeed: 200_000,
      accounts: [{ id: "a1", accountName: "IRA", accountType: "traditional_ira", currentBalance: 2_000_000, costBasisPct: 0 }],
    }));
    const caPlan = optimizeWithdrawals({
      ...base({ annualSpendingNeed: 200_000 }),
      stateCode: "CA",
      accounts: [{ id: "a1", accountName: "IRA", accountType: "traditional_ira", currentBalance: 2_000_000, costBasisPct: 0 }],
    });
    expect(caPlan.totalTax).toBeGreaterThan(txPlan.totalTax);
  });
});

// ── Withdrawal waterfall ordering ─────────────────────────────────────────────

describe("optimizeWithdrawals — ordering", () => {
  it("uses tax-free sources before taxable and traditional", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 300_000,
      accounts: [
        { id: "a1", accountName: "Trad IRA", accountType: "traditional_ira", currentBalance: 1_000_000, costBasisPct: 0 },
        { id: "a2", accountName: "Roth IRA", accountType: "roth_ira", currentBalance: 500_000, costBasisPct: 1 },
        { id: "a3", accountName: "Taxable", accountType: "taxable", currentBalance: 500_000, costBasisPct: 0.5 },
      ],
      insurance: [
        { id: "ins1", policyName: "PPLI", policyType: "ppli", cashValue: 400_000, outstandingLoan: 0, maxLoanPct: 0.9 },
      ],
    }));

    // The first step (lowest rank) should be from PPLI
    const sortedSteps = [...plan.steps].sort((a, b) => a.rank - b.rank);
    expect(sortedSteps[0].sourceType).toBe("ppli_loan");
  });

  it("stops drawing when spending need is met (doesn't over-withdraw)", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 50_000,
      accounts: [
        { id: "a1", accountName: "Roth IRA", accountType: "roth_ira", currentBalance: 1_000_000, costBasisPct: 1 },
        { id: "a2", accountName: "Trad IRA", accountType: "traditional_ira", currentBalance: 1_000_000, costBasisPct: 0 },
      ],
    }));
    // Should fully satisfy with Roth only — no traditional step needed
    expect(plan.steps.some(s => s.sourceType === "traditional")).toBe(false);
    expect(plan.steps.find(s => s.sourceType === "roth")!.grossAmount).toBeCloseTo(50_000, 0);
  });
});

// ── Summary metrics ───────────────────────────────────────────────────────────

describe("optimizeWithdrawals — summary", () => {
  it("totalGross = sum of step grossAmounts", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 200_000,
      accounts: [{ id: "a1", accountName: "Roth", accountType: "roth_ira", currentBalance: 500_000, costBasisPct: 1 }],
    }));
    const stepSum = plan.steps.reduce((s, step) => s + step.grossAmount, 0);
    expect(plan.totalGross).toBeCloseTo(stepSum, 1);
  });

  it("totalTax = sum of step taxCosts", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 200_000,
      accounts: [{ id: "a1", accountName: "Trad", accountType: "traditional_ira", currentBalance: 1_000_000, costBasisPct: 0 }],
    }));
    const stepTaxSum = plan.steps.reduce((s, step) => s + step.taxCost, 0);
    expect(plan.totalTax).toBeCloseTo(stepTaxSum, 1);
  });

  it("taxSavings is positive when mixing tax-free sources with traditional", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 200_000,
      accounts: [
        { id: "a1", accountName: "Roth IRA", accountType: "roth_ira", currentBalance: 200_000, costBasisPct: 1 },
        { id: "a2", accountName: "Trad IRA", accountType: "traditional_ira", currentBalance: 200_000, costBasisPct: 0 },
      ],
    }));
    // Some from Roth (tax-free) → lower total tax than all-traditional naive case
    expect(plan.taxSavings).toBeGreaterThan(0);
  });

  it("effectiveTaxRate is 0 when all from tax-free sources", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 100_000,
      accounts: [{ id: "r1", accountName: "Roth IRA", accountType: "roth_ira", currentBalance: 500_000, costBasisPct: 1 }],
    }));
    expect(plan.effectiveTaxRate).toBe(0);
  });

  it("unmetNeed is 0 when sufficient funds", () => {
    const plan = optimizeWithdrawals(base({
      annualSpendingNeed: 100_000,
      accounts: [{ id: "a1", accountName: "Roth IRA", accountType: "roth_ira", currentBalance: 500_000, costBasisPct: 1 }],
    }));
    expect(plan.unmetNeed).toBe(0);
    expect(plan.metNeed).toBe(100_000);
  });
});
