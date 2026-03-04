// ─────────────────────────────────────────────────────────────────────────────
// Cash Flow Waterfall — Timeline Builder
//
// Pure function: SimulationInput → LiquidityTimelineResult
// Does NOT run the 160-quarter engine — derives events directly from SimulationInput.
// ─────────────────────────────────────────────────────────────────────────────

import type { SimulationInput } from "../engine/types";
import type {
  CashEvent,
  CashEventSource,
  QuarterlyLiquidityBucket,
  LiquidityTimelineResult,
} from "./types";

const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"] as const;
const MAJOR_EVENT_THRESHOLD = 50_000;

// Rough after-tax rates — clearly labeled "estimated" in UI.
// Precise per-year tax is in the simulation engine; these are planning approximations.
const TAX_RATE_LTCG = 0.238;     // 20% LTCG + 3.8% NIIT
const TAX_RATE_ORDINARY = 0.50;  // ~37% federal + ~13% state (conservative for GP/LP)

function estimateTax(gross: number, character: "ltcg" | "ordinary" | "return_of_capital"): number {
  if (character === "return_of_capital") return 0;
  return gross * (character === "ltcg" ? TAX_RATE_LTCG : TAX_RATE_ORDINARY);
}

function pKey(year: number, quarter: string): string {
  return `${year}-${quarter}`;
}

function qIdx(year: number, quarter: string, startYear: number): number {
  const qi = QUARTER_LABELS.indexOf(quarter as "Q1" | "Q2" | "Q3" | "Q4");
  return (year - startYear) * 4 + qi;
}

export function buildLiquidityTimeline(
  input: SimulationInput,
  startYear: number,
  endYear: number,
): LiquidityTimelineResult {
  const events: CashEvent[] = [];

  // ── 1. Carry events — one event per realization tranche ─────────────────
  for (const c of input.carry) {
    for (const tranche of c.realizationSchedule) {
      const yr = tranche.year;
      if (yr < startYear || yr > endYear) continue;
      const gross = c.expectedGrossCarry * tranche.pct * (1 - c.haircutPct);
      if (gross <= 0) continue;
      const tax = estimateTax(gross, "ltcg");
      events.push({
        year: yr,
        quarter: tranche.quarter,
        periodKey: pKey(yr, tranche.quarter),
        source: "carry",
        label: c.fundName,
        grossAmount: gross,
        estimatedTax: tax,
        netAmount: gross - tax,
      });
    }
  }

  // ── 2. LP distribution events ─────────────────────────────────────────────
  for (const dist of input.lpDistributions) {
    if (dist.year < startYear || dist.year > endYear) continue;
    const tax = estimateTax(dist.amount, dist.taxCharacter);
    events.push({
      year: dist.year,
      quarter: dist.quarter,
      periodKey: pKey(dist.year, dist.quarter),
      source: "lp_distribution",
      label: dist.fundName,
      grossAmount: dist.amount,
      estimatedTax: tax,
      netAmount: dist.amount - tax,
      taxCharacter: dist.taxCharacter,
    });
  }

  // ── 3. Real estate sale events ───────────────────────────────────────────
  for (const prop of input.realEstate) {
    const saleYear = prop.projectedSaleYear;
    const saleQtr = prop.projectedSaleQuarter;
    if (!saleYear || !saleQtr) continue;
    if (saleYear < startYear || saleYear > endYear) continue;

    // Project value at sale using appreciation rate
    const yearsToSale = Math.max(0, saleYear - startYear);
    const projectedValue = prop.currentValue * Math.pow(1 + prop.appreciationRate, yearsToSale);
    const discount = 1 - (prop.llcValuationDiscountPct ?? 0);
    const discountedValue = projectedValue * prop.ownershipPct * discount;
    const mortgageBalance = prop.mortgage?.outstandingBalance ?? 0;
    const grossProceeds = Math.max(0, discountedValue - mortgageBalance);

    if (grossProceeds <= 0) continue;

    let tax = 0;
    if (!prop.is1031Exchange) {
      const basis = prop.purchasePrice * prop.ownershipPct;
      const gain = Math.max(0, grossProceeds - basis);
      tax = estimateTax(gain, "ltcg");
    }

    events.push({
      year: saleYear,
      quarter: saleQtr,
      periodKey: pKey(saleYear, saleQtr),
      source: "real_estate_sale",
      label: prop.propertyName,
      grossAmount: grossProceeds,
      estimatedTax: tax,
      netAmount: grossProceeds - tax,
    });
  }

  // ── 4. W-2 income (annual context bars — first 15 years) ────────────────
  if (input.income) {
    let salary = input.income.annualSalary;
    let bonus = input.income.annualBonus;
    const salaryGrowth = input.income.salaryGrowthRate ?? 0;
    const bonusGrowth = input.income.bonusGrowthRate ?? 0;
    const w2End = Math.min(endYear, startYear + 14);
    for (let year = startYear; year <= w2End; year++) {
      const gross = salary + bonus;
      if (gross > 0) {
        const tax = estimateTax(gross, "ordinary");
        events.push({
          year,
          quarter: "Q4",
          periodKey: pKey(year, "Q4"),
          source: "w2",
          label: "Salary + Bonus",
          grossAmount: gross,
          estimatedTax: tax,
          netAmount: gross - tax,
        });
      }
      salary *= 1 + salaryGrowth;
      bonus *= 1 + bonusGrowth;
    }
  }

  // ── 5. Rental income (annual summaries — first 10 years) ────────────────
  for (const prop of input.realEstate) {
    if (prop.propertyType !== "rental" && prop.propertyType !== "commercial") continue;
    const netAnnual = (prop.annualRentalIncome - prop.annualOperatingExpenses) * prop.ownershipPct;
    if (netAnnual <= 0) continue;

    const rentalEnd = Math.min(endYear, startYear + 9);
    for (let year = startYear; year <= rentalEnd; year++) {
      if (prop.projectedSaleYear && year >= prop.projectedSaleYear) continue;
      const tax = estimateTax(netAnnual, "ordinary");
      events.push({
        year,
        quarter: "Q4",
        periodKey: pKey(year, "Q4"),
        source: "rental",
        label: prop.propertyName,
        grossAmount: netAnnual,
        estimatedTax: tax,
        netAmount: netAnnual - tax,
      });
    }
  }

  // ── Sort events chronologically ─────────────────────────────────────────
  events.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    const qi = QUARTER_LABELS.indexOf(a.quarter) - QUARTER_LABELS.indexOf(b.quarter);
    return qi !== 0 ? qi : a.source.localeCompare(b.source);
  });

  // ── Build quarterly buckets ──────────────────────────────────────────────
  const quarterMap = new Map<string, QuarterlyLiquidityBucket>();

  for (let year = startYear; year <= endYear; year++) {
    for (const q of QUARTER_LABELS) {
      const key = pKey(year, q);
      quarterMap.set(key, {
        year,
        quarter: q,
        periodKey: key,
        qIndex: qIdx(year, q, startYear),
        carryNet: 0,
        lpNet: 0,
        realEstateSaleNet: 0,
        w2Net: 0,
        rentalNet: 0,
        totalNet: 0,
        cumulativeNet: 0,
        hasMajorEvent: false,
        events: [],
      });
    }
  }

  for (const event of events) {
    const bucket = quarterMap.get(event.periodKey);
    if (!bucket) continue;
    bucket.events.push(event);
    switch (event.source) {
      case "carry":          bucket.carryNet += event.netAmount; break;
      case "lp_distribution":bucket.lpNet += event.netAmount; break;
      case "real_estate_sale":bucket.realEstateSaleNet += event.netAmount; break;
      case "w2":             bucket.w2Net += event.netAmount; break;
      case "rental":         bucket.rentalNet += event.netAmount; break;
    }
    bucket.totalNet += event.netAmount;
  }

  // Compute cumulative and hasMajorEvent in chronological order
  let running = 0;
  const sortedBuckets = Array.from(quarterMap.values()).sort((a, b) => a.qIndex - b.qIndex);

  for (const bucket of sortedBuckets) {
    running += bucket.totalNet;
    bucket.cumulativeNet = running;
    bucket.hasMajorEvent =
      bucket.carryNet > MAJOR_EVENT_THRESHOLD ||
      bucket.lpNet > MAJOR_EVENT_THRESHOLD ||
      bucket.realEstateSaleNet > MAJOR_EVENT_THRESHOLD;
  }

  const significantQuarters = sortedBuckets.filter(b => b.hasMajorEvent);

  // ── Aggregate totals ─────────────────────────────────────────────────────
  const bySource = (src: CashEventSource) =>
    events.filter(e => e.source === src).reduce((s, e) => s + e.netAmount, 0);

  return {
    events,
    quarters: sortedBuckets,
    significantQuarters,
    carryFunds: [],   // enriched in the router
    lpFunds: [],      // enriched in the router
    totals: {
      totalGrossCarry: input.carry.reduce((s, c) => s + c.expectedGrossCarry, 0),
      totalNetCarry: bySource("carry"),
      totalLPDistributions: bySource("lp_distribution"),
      totalRealEstateSaleProceeds: bySource("real_estate_sale"),
      totalW2: bySource("w2"),
      totalRental: bySource("rental"),
      grandTotalNet: sortedBuckets.at(-1)?.cumulativeNet ?? 0,
    },
    startYear,
    endYear,
  };
}
