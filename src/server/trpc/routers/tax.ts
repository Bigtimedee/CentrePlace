import { createTRPCRouter, protectedProcedure } from "../index";
import { assembleSimInput } from "../../simulation/assembler";
import { runSimulation } from "../../simulation/engine/quarterly-engine";
import { getMarginalOrdinaryRate, getMarginalLtcgRate } from "../../simulation/tax/federal-income";
import type {
  AnnualTaxProjection,
  TaxPlanningResult,
  CarrySensitivityResult,
} from "../../simulation/tax/projection-types";

// ── 2026 bracket thresholds (mirrors federal-income.ts) ──────────────────────

const STD_DED = { single: 8_300, married_filing_jointly: 16_600 } as const;
const ORDINARY_25_THRESHOLD = { single: 103_350, married_filing_jointly: 206_700 } as const;
const LTCG_ZERO_THRESHOLD = { single: 48_350, married_filing_jointly: 96_700 } as const;
const LTCG_15_THRESHOLD = { single: 533_400, married_filing_jointly: 600_050 } as const;

// ─────────────────────────────────────────────────────────────────────────────

export const taxRouter = createTRPCRouter({
  /**
   * Projected annual tax breakdown for the full 40-year simulation window.
   * Includes bracket headroom, Roth conversion capacity, and discrete tax events.
   */
  projectedTaxTimeline: protectedProcedure.query(async ({ ctx }): Promise<TaxPlanningResult> => {
    const simInput = await assembleSimInput(ctx);
    const result = runSimulation(simInput);
    const filingStatus = simInput.profile.filingStatus;

    const projections: AnnualTaxProjection[] = result.quarters
      .filter(q => q.quarterLabel === "Q4")
      .map(q => {
        const stdDed = STD_DED[filingStatus];
        const taxableOrdinary = Math.max(0, q.annualOrdinaryIncome - stdDed);
        const stackedForLtcg = taxableOrdinary + q.annualLtcgIncome;

        const marginalOrdinary = getMarginalOrdinaryRate(taxableOrdinary, filingStatus, q.year);
        const marginalLtcg = getMarginalLtcgRate(stackedForLtcg, filingStatus, q.year);

        const ordinary25Top = ORDINARY_25_THRESHOLD[filingStatus];
        const ltcgZeroTop = LTCG_ZERO_THRESHOLD[filingStatus];
        const ltcg15Top = LTCG_15_THRESHOLD[filingStatus];

        const ordinaryHeadroom = Math.max(0, ordinary25Top - taxableOrdinary);
        const ltcgZeroHeadroom = Math.max(0, ltcgZeroTop - stackedForLtcg);
        const ltcg15Headroom = Math.max(0, ltcg15Top - stackedForLtcg);

        // Roth conversion: how much room before hitting 25% ordinary bracket
        const rothCapacity = Math.max(0, ordinary25Top - taxableOrdinary);
        const rothTaxCost = rothCapacity * marginalOrdinary;

        // Carry events this year
        const carryEvents = simInput.carry
          .filter(c => c.expectedRealizationYear === q.year)
          .map(c => {
            const net = c.expectedGrossCarry * (1 - c.haircutPct);
            const stacked = taxableOrdinary + net + q.annualLtcgIncome;
            const ltcgRate = getMarginalLtcgRate(stacked, filingStatus, q.year);
            return {
              fundName: c.fundName,
              netCarryAmount: net,
              estimatedTax: net * (ltcgRate + 0.038), // LTCG rate + NIIT
            };
          });

        // LP distribution events this year (skip return_of_capital for tax estimate)
        const lpEvents = simInput.lpDistributions
          .filter(d => d.year === q.year)
          .map(d => {
            const estimatedTax =
              d.taxCharacter === "return_of_capital"
                ? 0
                : d.taxCharacter === "ltcg"
                  ? d.amount * (marginalLtcg + 0.038)
                  : d.amount * marginalOrdinary;
            return {
              fundName: d.fundName,
              amount: d.amount,
              taxCharacter: d.taxCharacter,
              estimatedTax,
            };
          });

        // Real estate sale events this year (non-1031)
        const reSaleEvents = simInput.realEstate
          .filter(p => p.projectedSaleYear === q.year && !p.is1031Exchange)
          .map(p => {
            const gain = Math.max(0, p.currentValue - p.purchasePrice) * p.ownershipPct;
            return {
              propertyName: p.propertyName,
              gainAmount: gain,
              estimatedTax: gain * (marginalLtcg + 0.038),
            };
          });

        return {
          year: q.year,
          age: q.age,
          ordinaryIncome: q.annualOrdinaryIncome,
          ltcgIncome: q.annualLtcgIncome,
          totalIncome: q.annualOrdinaryIncome + q.annualLtcgIncome,
          federalOrdinaryTax: q.annualFederalOrdinaryTax,
          federalLtcgTax: q.annualFederalLtcgTax,
          federalNiit: q.annualFederalNiit,
          totalFederalTax: q.annualFederalOrdinaryTax + q.annualFederalLtcgTax + q.annualFederalNiit,
          stateIncomeTax: q.annualStateTax,
          totalTax: q.annualTotalTax,
          effectiveTotalRate: q.annualEffectiveTaxRate,
          marginalOrdinaryRate: marginalOrdinary,
          marginalLtcgRate: marginalLtcg,
          ordinaryBracketHeadroom: ordinaryHeadroom,
          ltcgZeroBracketHeadroom: ltcgZeroHeadroom,
          ltcg15BracketHeadroom: ltcg15Headroom,
          rothConversionCapacity: rothCapacity,
          estimatedRothTaxCost: rothTaxCost,
          carryEvents,
          lpEvents,
          reSaleEvents,
        };
      });

    const nonZero = projections.filter(p => p.totalIncome > 0);
    const avgRate = nonZero.length > 0
      ? nonZero.reduce((s, p) => s + p.effectiveTotalRate, 0) / nonZero.length
      : 0;

    const peak = projections.reduce(
      (best, p) => p.totalTax > best.totalTax ? p : best,
      projections[0] ?? { year: 0, totalTax: 0 },
    );

    return {
      projections,
      totalTaxOverWindow: projections.reduce((s, p) => s + p.totalTax, 0),
      averageEffectiveTaxRate: avgRate,
      peakTaxYear: peak.year,
      peakTaxAmount: peak.totalTax,
    };
  }),

  /**
   * 5-point carry sensitivity sweep.
   * Overrides each carry position's haircutPct absolutely (0% → 100% haircut)
   * and returns how FI year and peak-tax year shift at each outcome.
   */
  carrySensitivity: protectedProcedure.query(async ({ ctx }): Promise<CarrySensitivityResult> => {
    const baseInput = await assembleSimInput(ctx);
    const baseCarryGross = baseInput.carry.reduce((s, c) => s + c.expectedGrossCarry, 0);

    const realizationPoints = [0.0, 0.25, 0.50, 0.75, 1.0];

    const points = realizationPoints.map(realizationPct => {
      const haircutPct = 1 - realizationPct;

      const modifiedInput = {
        ...baseInput,
        carry: baseInput.carry.map(c => ({ ...c, haircutPct })),
      };

      const result = runSimulation(modifiedInput);

      const annualTaxes = result.quarters
        .filter(q => q.quarterLabel === "Q4")
        .map(q => ({ year: q.year, tax: q.annualTotalTax }));

      const peakEntry = annualTaxes.reduce(
        (best, e) => e.tax > best.tax ? e : best,
        { year: 0, tax: 0 },
      );

      const totalNetCarry = baseInput.carry.reduce(
        (s, c) => s + c.expectedGrossCarry * realizationPct,
        0,
      );

      return {
        realizationPct,
        haircutPct,
        fiYear: result.fiDate?.year ?? null,
        fiAge: result.fiAge,
        peakTaxYear: peakEntry.tax > 0 ? peakEntry.year : null,
        peakTaxAmount: peakEntry.tax,
        totalNetCarry,
      };
    });

    return { baseCarryGross, points };
  }),
});
