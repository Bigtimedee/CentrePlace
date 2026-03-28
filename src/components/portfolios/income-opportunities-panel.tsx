"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterType = "all" | "tax-free" | "dividend" | "fixed-income";

interface OpportunityCard {
  id: string;
  category: string;
  categoryColor: string;
  filterType: FilterType;
  tickers: string[];
  yieldLow: number;
  yieldHigh: number;
  taxEquivalentYieldHigh?: number; // at 37% bracket
  title: string;
  description: string;
  taxNote: string;
}

// ── Opportunity definitions ────────────────────────────────────────────────────

function buildOpportunities(
  hasTaxable: boolean,
  hasTraditional: boolean,
  taxBracket: number,
  incomeGap: number
): OpportunityCard[] {
  const cards: OpportunityCard[] = [];

  // Dividend Growth — universal
  cards.push({
    id: "dividend-growth",
    category: "Dividend Growth",
    categoryColor: "bg-emerald-100 text-emerald-800",
    filterType: "dividend",
    tickers: ["SCHD", "VIG", "DGRO"],
    yieldLow: 2.0,
    yieldHigh: 3.5,
    title: "Dividend Growth ETF",
    description:
      "Broad baskets of companies with consistent dividend growth. Qualified dividends taxed at preferential LTCG rates.",
    taxNote: "Qualified dividend income — taxed at 0%, 15%, or 20% vs. ordinary income rates.",
  });

  // Municipal Bond Fund — high income + taxable
  if (hasTaxable && taxBracket >= 0.24) {
    const teYield = 3.75 / (1 - taxBracket); // tax-equivalent at user's bracket
    cards.push({
      id: "muni-bond",
      category: "Tax-Free Income",
      categoryColor: "bg-sky-100 text-sky-800",
      filterType: "tax-free",
      tickers: ["VWIUX", "MUB", "VTEB"],
      yieldLow: 3.5,
      yieldHigh: 4.0,
      taxEquivalentYieldHigh: Math.round(teYield * 10) / 10,
      title: "Municipal Bond Fund",
      description:
        "Federally tax-exempt bond funds ideal for high-income earners in taxable accounts. Most funds also exempt from state tax for in-state bonds.",
      taxNote: "Federally tax-exempt. Tax-equivalent yield shown at your estimated bracket.",
    });
  }

  // Short-Duration Treasury — traditional IRA
  if (hasTraditional) {
    cards.push({
      id: "treasury",
      category: "Fixed Income",
      categoryColor: "bg-violet-100 text-violet-800",
      filterType: "fixed-income",
      tickers: ["VGSH", "SHY"],
      yieldLow: 4.5,
      yieldHigh: 5.0,
      title: "Short-Duration Treasury",
      description:
        "Short-term government bonds inside a Traditional IRA shelter ordinary interest income from current taxation, improving compounding.",
      taxNote: "Ordinary income taxed at withdrawal. Ideal inside Traditional IRA to defer taxation.",
    });
  }

  // High-Yield Income — large gap
  if (incomeGap >= 25_000) {
    cards.push({
      id: "high-yield",
      category: "High Yield",
      categoryColor: "bg-amber-100 text-amber-800",
      filterType: "dividend",
      tickers: ["JEPI", "JEPQ"],
      yieldLow: 6.0,
      yieldHigh: 9.0,
      title: "High-Yield Income ETF",
      description:
        "Options-overlay ETFs generating high monthly distributions. JEPI writes covered calls on S&P 500; JEPQ on Nasdaq-100.",
      taxNote:
        "Distributions are primarily ordinary income (not qualified dividends) — less tax-efficient in taxable accounts. Best inside tax-advantaged accounts.",
    });
  }

  return cards;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + Math.round(n).toLocaleString("en-US");
}

// Round investment suggestion to nearest $25K, min $25K
function roundTo25K(n: number): number {
  return Math.max(25_000, Math.round(n / 25_000) * 25_000);
}

// ── Opportunity card component ────────────────────────────────────────────────

function OpportunityCardView({
  card,
  incomeGap,
}: {
  card: OpportunityCard;
  incomeGap: number;
}) {
  const midYield = (card.yieldLow + card.yieldHigh) / 2 / 100;
  const investmentNeeded =
    incomeGap > 0 && midYield > 0
      ? roundTo25K(incomeGap / midYield)
      : null;
  const annualYieldFromInvestment =
    investmentNeeded != null
      ? Math.round(investmentNeeded * midYield)
      : null;

  return (
    <div className="rounded-lg border border-gray-100 bg-slate-50 p-4 flex flex-col gap-3">
      {/* Top row: category badge + tickers */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${card.categoryColor}`}
        >
          {card.category}
        </span>
        <div className="flex gap-1 flex-wrap justify-end">
          {card.tickers.map((t) => (
            <span
              key={t}
              className="rounded bg-white px-1.5 py-0.5 text-xs font-mono font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Title + description */}
      <div>
        <p className="text-sm font-semibold text-slate-900">{card.title}</p>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          {card.description}
        </p>
      </div>

      {/* Yield stats */}
      <div className="flex gap-4 text-xs text-slate-600">
        <span>
          <span className="font-medium">Yield:</span>{" "}
          {card.yieldLow.toFixed(1)}–{card.yieldHigh.toFixed(1)}%
        </span>
        {card.taxEquivalentYieldHigh != null && (
          <span>
            <span className="font-medium">Tax-equiv.:</span>{" "}
            {card.taxEquivalentYieldHigh.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Impact estimate */}
      {investmentNeeded != null && annualYieldFromInvestment != null && incomeGap > 0 && (
        <div className="rounded bg-white px-3 py-2 ring-1 ring-inset ring-slate-200 text-xs text-slate-600">
          Investing {fmtMoney(investmentNeeded)} could generate{" "}
          <span className="font-semibold text-slate-800">
            ~{fmtMoney(annualYieldFromInvestment)}/year
          </span>
        </div>
      )}

      {/* Tax note */}
      <p className="text-xs text-slate-400 italic leading-relaxed">{card.taxNote}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function IncomeOpportunitiesPanel() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const { data: simData, isLoading: simLoading } = trpc.simulation.run.useQuery(
    undefined,
    { retry: false, staleTime: 60_000 }
  );

  const { data: accounts, isLoading: accountsLoading } =
    trpc.portfolios.list.useQuery();

  const { data: holdings, isLoading: holdingsLoading } =
    trpc.portfolios.listAllHoldings.useQuery();

  const isLoading = simLoading || accountsLoading || holdingsLoading;

  // Don't render if no holdings
  if (holdingsLoading) return null;
  if (!holdings || holdings.length === 0) return null;
  if (isLoading) return null;
  if (!simData) return null;

  // ── Derive income gap (same logic as IncomeGapCard) ─────────────────────────

  const currentYear = new Date().getFullYear();
  const currentYearQuarters = simData.quarters.filter(
    (q) => q.year === currentYear
  );
  const src =
    currentYearQuarters.length === 4 ? currentYearQuarters : simData.quarters.slice(0, 4);

  const totalIncome = src.reduce(
    (s, q) =>
      s +
      q.w2Income +
      q.portfolioYieldIncome +
      q.rentalNetIncome +
      q.lpIncome +
      q.carryIncome,
    0
  );
  const annualSpending = simData.summary.projectedAnnualSpending ?? 0;
  const incomeGap = Math.max(0, annualSpending - totalIncome);

  // ── Account type analysis ────────────────────────────────────────────────────

  const accountTypes = new Set((accounts ?? []).map((a) => a.accountType));
  const hasTaxable = accountTypes.has("taxable");
  const hasTraditional =
    accountTypes.has("traditional_ira") ||
    accountTypes.has("traditional_401k") ||
    accountTypes.has("sep_ira") ||
    accountTypes.has("solo_401k");

  // ── Tax bracket approximation ────────────────────────────────────────────────
  // This is a rough proxy — not a tax calculation. Replace with real bracket data if available.
  const annualW2 = src.reduce((s, q) => s + q.w2Income, 0);
  const estimatedBracket = Math.min(0.37, annualW2 / 500_000 * 0.37);

  // ── Build opportunity cards ───────────────────────────────────────────────────

  const allCards = buildOpportunities(
    hasTaxable,
    hasTraditional,
    estimatedBracket,
    incomeGap
  );

  const visibleCards =
    activeFilter === "all"
      ? allCards
      : allCards.filter((c) => c.filterType === activeFilter);

  if (allCards.length === 0) return null;

  const filters: { value: FilterType; label: string }[] = [
    { value: "all", label: "All Types" },
    { value: "tax-free", label: "Tax-Free" },
    { value: "dividend", label: "Dividend" },
    { value: "fixed-income", label: "Fixed Income" },
  ];

  // Only show filter pills for types that have at least one card
  const availableFilters = filters.filter(
    (f) => f.value === "all" || allCards.some((c) => c.filterType === f.value)
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
          <h2 className="text-lg font-semibold text-slate-900">
            Income-Generating Opportunities
          </h2>
        </div>
        <p className="text-sm text-slate-500 ml-9">
          {incomeGap > 0
            ? `Curated to help close your ${fmtMoney(incomeGap)} annual income gap`
            : "Curated income strategies matched to your account types and tax profile"}
        </p>
      </div>

      {/* Filter pills */}
      {availableFilters.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {availableFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeFilter === f.value
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Cards grid */}
      {visibleCards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => (
            <OpportunityCardView key={card.id} card={card} incomeGap={incomeGap} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">
          No opportunities match the selected filter.
        </p>
      )}

      {/* Methodology disclosure */}
      <details className="mt-6 text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">
          Methodology disclosure
        </summary>
        <div className="mt-2 space-y-1 leading-relaxed">
          <p>
            Opportunities are curated based on your account types (taxable, Traditional
            IRA/401k, Roth IRA/401k) and an estimated marginal tax bracket derived from
            W-2 income as a rough proxy. This is not a tax calculation.
          </p>
          <p>
            Yield ranges are approximate current market estimates and will vary with
            interest rates and market conditions. Tax-equivalent yield is calculated as
            nominal yield / (1 - estimated bracket).
          </p>
          <p>
            Investment impact estimates (investing $X generates ~$Y/year) assume the
            midpoint of the stated yield range applied to the minimum investment needed
            to close the income gap, rounded to the nearest $25,000.
          </p>
          <p className="font-medium text-slate-600">
            GPRetire provides general educational information about income-generating
            investment categories. This is not personalized investment advice. All
            investment decisions are made solely at your own discretion and risk.
          </p>
        </div>
      </details>
    </div>
  );
}
