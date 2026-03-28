"use client";

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { trpc } from "@/lib/trpc";
import type { QuarterResult } from "@/server/simulation/engine/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + Math.round(n).toLocaleString("en-US");
}

// ── Data preparation ──────────────────────────────────────────────────────────

interface QuarterRow {
  label: string;
  w2: number;
  portfolioYield: number;
  rental: number;
  lpCarry: number;
  totalIncome: number;
  spending: number;
  isDeficit: boolean;
}

function buildQuarterRows(quarters: QuarterResult[], currentYear: number): QuarterRow[] {
  const currentYearQuarters = quarters.filter((q) => q.year === currentYear);

  // If simulation hasn't run to current year, take the first 4 available quarters.
  const src =
    currentYearQuarters.length === 4
      ? currentYearQuarters
      : quarters.slice(0, 4);

  return src.map((q) => {
    const spending =
      q.recurringSpending +
      q.oneTimeSpending +
      q.mortgagePayments +
      q.insurancePremiums;

    const totalIncome =
      q.w2Income +
      q.portfolioYieldIncome +
      q.rentalNetIncome +
      q.lpIncome +
      q.carryIncome;

    return {
      label: q.quarterLabel,
      w2: Math.round(q.w2Income),
      portfolioYield: Math.round(q.portfolioYieldIncome),
      rental: Math.round(q.rentalNetIncome),
      lpCarry: Math.round(q.lpIncome + q.carryIncome),
      totalIncome: Math.round(totalIncome),
      spending: Math.round(spending),
      isDeficit: totalIncome < spending,
    };
  });
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "rose" | "sky" | "slate";
}) {
  const colorMap = {
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    sky: "text-sky-600",
    slate: "text-slate-900",
  };
  return (
    <div className="bg-slate-50 rounded-lg px-4 py-3 flex-1 min-w-0">
      <p className="text-xs text-slate-500 mb-1 truncate">{label}</p>
      <p
        className={`text-base font-semibold tabular-nums ${
          colorMap[accent ?? "slate"]
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[180px]">
      <p className="text-slate-600 mb-2 font-medium">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4 mb-1"
        >
          <span style={{ color: entry.fill ?? entry.color }}>{entry.name}</span>
          <span className="text-slate-900 font-semibold">{fmtK(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TwelveMonthProjection() {
  const { data: simData, isLoading } = trpc.simulation.run.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  const { data: yieldSummary } = trpc.portfolios.getPortfolioYieldSummary.useQuery(
    undefined,
    { enabled: false, staleTime: 300_000 }
  );

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        </div>
      </div>
    );
  }

  if (!simData) return null;

  const currentYear = new Date().getFullYear();
  const rows = buildQuarterRows(simData.quarters, currentYear);

  if (rows.length === 0) return null;

  // ── Derived annual KPIs ────────────────────────────────────────────────────

  const annualIncome = rows.reduce((s, r) => s + r.totalIncome, 0);
  const annualSpending = rows.reduce((s, r) => s + r.spending, 0);
  const netPosition = annualIncome - annualSpending;

  // Portfolio yield: use enriched if available, otherwise sum simulation yield
  const simAnnualYield = rows.reduce((s, r) => s + r.portfolioYield, 0);
  const enrichedYield = yieldSummary?.estimatedAnnualYieldIncome;
  const portfolioYieldDisplay = enrichedYield != null ? enrichedYield : simAnnualYield;
  const totalPortfolioValue = (simData.summary.totalCapitalToday ?? 0);
  const yieldPct =
    totalPortfolioValue > 0 ? portfolioYieldDisplay / totalPortfolioValue : null;

  const avgQuarterlySpending =
    rows.length > 0 ? annualSpending / rows.length : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
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
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </span>
          <h2 className="text-lg font-semibold text-slate-900">
            12-Month Income Projection
          </h2>
        </div>
        <p className="text-sm text-slate-500 ml-9">
          Quarterly income by source vs. spending for {currentYear}
        </p>
      </div>

      {/* KPI strip */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <KpiTile
          label="12-Month Income"
          value={fmtMoney(annualIncome)}
          accent="emerald"
        />
        <KpiTile
          label="12-Month Spending"
          value={fmtMoney(annualSpending)}
          accent="rose"
        />
        <KpiTile
          label="Net Position"
          value={(netPosition >= 0 ? "+" : "") + fmtMoney(netPosition)}
          accent={netPosition >= 0 ? "emerald" : "rose"}
        />
        <KpiTile
          label="Portfolio Yield %"
          value={yieldPct != null ? (yieldPct * 100).toFixed(1) + "%" : "—"}
          sub={
            yieldPct != null
              ? fmtMoney(portfolioYieldDisplay) + "/yr"
              : undefined
          }
          accent="sky"
        />
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart
          data={rows}
          margin={{ top: 4, right: 8, bottom: 0, left: 16 }}
          barGap={4}
          barCategoryGap="30%"
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />

          {/* Average quarterly spending reference line */}
          {avgQuarterlySpending > 0 && (
            <ReferenceLine
              y={avgQuarterlySpending}
              stroke="#94a3b8"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: "Avg spending",
                position: "right",
                fontSize: 10,
                fill: "#94a3b8",
              }}
            />
          )}

          {/* Stacked income bars */}
          <Bar
            dataKey="w2"
            name="W-2"
            stackId="income"
            fill="#10b981"
            maxBarSize={32}
          />
          <Bar
            dataKey="portfolioYield"
            name="Portfolio Yield"
            stackId="income"
            fill="#0ea5e9"
            maxBarSize={32}
          />
          <Bar
            dataKey="rental"
            name="Rental"
            stackId="income"
            fill="#14b8a6"
            maxBarSize={32}
          />
          <Bar
            dataKey="lpCarry"
            name="LP / Carry"
            stackId="income"
            fill="#6366f1"
            maxBarSize={32}
            radius={[2, 2, 0, 0]}
          />

          {/* Spending bar — rose, slightly offset via second stack */}
          <Bar
            dataKey="spending"
            name="Spending"
            stackId="spending"
            maxBarSize={20}
            radius={[2, 2, 0, 0]}
          >
            {rows.map((row) => (
              <Cell
                key={row.label}
                fill={row.isDeficit ? "#f43f5e" : "#fda4af"}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Deficit legend note */}
      {rows.some((r) => r.isDeficit) && (
        <p className="mt-3 text-xs text-rose-500 text-center">
          Darker rose bars indicate quarters where spending exceeds income.
        </p>
      )}
    </div>
  );
}
