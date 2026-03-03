"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { CashflowSummaryCards } from "./cashflow-summary-cards";
import { CashflowFilterBar } from "./cashflow-filter-bar";
import { LiquidityWaterfallChart } from "./liquidity-waterfall-chart";
import { CashEventTimeline } from "./cash-event-timeline";
import { CarryPipelineTable } from "./carry-pipeline-table";
import { LPDistributionTable } from "./lp-distribution-table";
import type { CashEventSource } from "@/server/simulation/cashflow/types";

// Default: carry + LP + RE visible; W-2 + rental hidden (context, not primary focus)
const DEFAULT_ACTIVE: Set<CashEventSource> = new Set(["carry", "lp_distribution", "real_estate_sale"]);

export function CashflowCenter() {
  const [activeSources, setActiveSources] = useState<Set<CashEventSource>>(DEFAULT_ACTIVE);
  const [viewMode, setViewMode] = useState<"annual" | "quarterly">("annual");

  const { data, isLoading, error } = trpc.cashflow.liquidityTimeline.useQuery(undefined, {
    staleTime: 120_000,
    retry: false,
  });

  function toggleSource(src: CashEventSource) {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(src)) next.delete(src);
      else next.add(src);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
        <svg className="animate-spin h-5 w-5 mr-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Building liquidity timeline…
      </div>
    );
  }

  if (error || !data) {
    const isProfileMissing = error?.data?.code === "PRECONDITION_FAILED";
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
        {isProfileMissing ? (
          <>
            <p className="mb-3">Complete your profile to see the liquidity timeline.</p>
            <Link
              href="/profile"
              className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Go to Profile →
            </Link>
          </>
        ) : (
          <p>Unable to load cashflow data: {error?.message}</p>
        )}
      </div>
    );
  }

  const hasEvents = data.significantQuarters.length > 0;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <CashflowSummaryCards
        totals={data.totals}
        carryCount={data.carryFunds.length}
        lpCount={data.lpFunds.length}
      />

      {/* Primary waterfall chart */}
      <Card>
        <CardHeader
          title="Cash Arrival by Year"
          description="Net after estimated tax by source — indigo line = running cumulative total"
        />
        <CardBody>
          <div className="mb-4">
            <CashflowFilterBar
              activeSources={activeSources}
              onToggle={toggleSource}
              viewMode={viewMode}
              onToggleViewMode={() => setViewMode(v => v === "annual" ? "quarterly" : "annual")}
            />
          </div>
          <LiquidityWaterfallChart
            quarters={data.quarters}
            activeSources={activeSources}
            viewMode={viewMode}
          />
        </CardBody>
      </Card>

      {/* Significant event timeline strip */}
      {hasEvents && (
        <Card>
          <CardHeader
            title="Major Cash Events"
            description={`${data.significantQuarters.length} quarter${data.significantQuarters.length !== 1 ? "s" : ""} with significant carry, LP, or RE proceeds (>$50K net)`}
          />
          <CardBody>
            <CashEventTimeline
              significantQuarters={data.significantQuarters}
              activeSources={activeSources}
            />
          </CardBody>
        </Card>
      )}

      {/* Two-column: GP carry pipeline + LP summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="GP Carry Pipeline"
            description={`${data.carryFunds.length} fund${data.carryFunds.length !== 1 ? "s" : ""} · sorted by realization year`}
          />
          <CardBody>
            <CarryPipelineTable funds={data.carryFunds} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="LP Distribution Schedule"
            description={`${data.lpFunds.length} fund${data.lpFunds.length !== 1 ? "s" : ""} · sorted by first distribution year`}
          />
          <CardBody>
            <LPDistributionTable funds={data.lpFunds} />
          </CardBody>
        </Card>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Tax estimates use flat rates (23.8% for LTCG+NIIT, 50% for ordinary) as planning approximations.
        Precise per-year tax liability is modeled in the Tax Planning page.
        Real estate proceeds are projected using your entered appreciation rate; actual sale value will vary.
      </p>
    </div>
  );
}
