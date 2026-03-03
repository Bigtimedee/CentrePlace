import { createTRPCRouter, protectedProcedure } from "../index";
import { assembleSimInput } from "../../simulation/assembler";
import { carryPositions, lpInvestments } from "../../db/schema";
import { eq } from "drizzle-orm";
import { buildLiquidityTimeline } from "../../simulation/cashflow/timeline-builder";
import type { CarryFundSummary, LPFundSummary, LiquidityTimelineResult } from "../../simulation/cashflow/types";

export const cashflowRouter = createTRPCRouter({
  /**
   * Build the full liquidity timeline — all cash events across the 40-year
   * window, aggregated by quarter and broken down by source.
   */
  liquidityTimeline: protectedProcedure.query(async ({ ctx }): Promise<LiquidityTimelineResult> => {
    const uid = ctx.userId;
    const startYear = new Date().getFullYear();
    const endYear = startYear + 39;

    // Run assembler + DB fetches in parallel
    const [simInput, fullCarry, fullLp] = await Promise.all([
      assembleSimInput(ctx),
      ctx.db.query.carryPositions.findMany({
        where: eq(carryPositions.userId, uid),
        orderBy: (t, { asc }) => [asc(t.expectedRealizationYear)],
      }),
      ctx.db.query.lpInvestments.findMany({
        where: eq(lpInvestments.userId, uid),
        orderBy: (t, { asc }) => [asc(t.vintageYear)],
      }),
    ]);

    const result = buildLiquidityTimeline(simInput, startYear, endYear);

    // Enrich carry fund summaries with full DB fields
    const totalNetCarry = result.totals.totalNetCarry;
    const enrichedCarryFunds: CarryFundSummary[] = fullCarry.map(c => {
      const netCarry = c.expectedGrossCarry * (1 - c.haircutPct);
      const tax = netCarry * 0.238; // 20% LTCG + 3.8% NIIT
      return {
        fundName: c.fundName,
        vintageYear: c.vintageYear,
        carryPct: c.carryPct,
        currentTvpi: c.currentTvpi,
        totalCommittedCapital: c.totalCommittedCapital,
        expectedGrossCarry: c.expectedGrossCarry,
        haircutPct: c.haircutPct,
        netCarry,
        realizationYear: c.expectedRealizationYear,
        realizationQuarter: c.expectedRealizationQuarter as "Q1" | "Q2" | "Q3" | "Q4",
        estimatedTax: tax,
        netAfterTax: netCarry - tax,
        pipelineSharePct: totalNetCarry > 0 ? netCarry / totalNetCarry : 0,
      };
    });

    // Build LP fund summaries
    const enrichedLpFunds: LPFundSummary[] = fullLp.map(lp => {
      const dists = lp.expectedDistributions ?? [];
      const total = dists.reduce((s, d) => s + d.amount, 0);
      const years = dists.map(d => d.year);
      return {
        fundName: lp.fundName,
        vintageYear: lp.vintageYear,
        commitmentAmount: lp.commitmentAmount,
        currentNav: lp.currentNav,
        totalExpectedDistributions: total,
        firstDistributionYear: years.length > 0 ? Math.min(...years) : null,
        lastDistributionYear: years.length > 0 ? Math.max(...years) : null,
        distributionCount: dists.length,
      };
    });

    return { ...result, carryFunds: enrichedCarryFunds, lpFunds: enrichedLpFunds };
  }),
});
