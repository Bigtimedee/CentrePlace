"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { TaxSummaryCards } from "./tax-summary-cards";
import { TaxTimelineChart } from "./tax-timeline-chart";
import { BracketHeatmap } from "./bracket-heatmap";
import { CarrySensitivityPanel } from "./carry-sensitivity-panel";
import { RothConversionLadder } from "./roth-conversion-ladder";
import { TaxEventTable } from "./tax-event-table";

export function TaxCenter() {
  const {
    data: taxData,
    isLoading: taxLoading,
    error: taxError,
  } = trpc.tax.projectedTaxTimeline.useQuery(undefined, {
    staleTime: 120_000,
    retry: false,
  });

  const {
    data: sensitivityData,
    isLoading: sensitivityLoading,
  } = trpc.tax.carrySensitivity.useQuery(undefined, {
    staleTime: 120_000,
    retry: false,
  });

  if (taxLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
        <svg className="animate-spin h-5 w-5 mr-3 text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Computing tax projections…
      </div>
    );
  }

  if (taxError || !taxData) {
    const isProfileMissing = taxError?.data?.code === "PRECONDITION_FAILED";
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
        {isProfileMissing ? (
          <>
            <p className="mb-3">Complete your profile to see tax projections.</p>
            <Link
              href="/profile"
              className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Go to Profile →
            </Link>
          </>
        ) : (
          <p>Unable to load tax data: {taxError?.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <TaxSummaryCards data={taxData} />

      {/* Primary timeline chart */}
      <Card>
        <CardBody>
          <TaxTimelineChart projections={taxData.projections} />
        </CardBody>
      </Card>

      {/* Two-column: bracket heatmap + carry sensitivity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardBody>
            <BracketHeatmap projections={taxData.projections} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <CarrySensitivityPanel
              data={sensitivityData ?? null}
              isLoading={sensitivityLoading}
            />
          </CardBody>
        </Card>
      </div>

      {/* Roth conversion ladder */}
      <Card>
        <CardHeader
          title="Roth Conversion Opportunities"
          description="Projected room to convert IRA/401k assets before hitting the 25% bracket each year"
        />
        <CardBody>
          <RothConversionLadder projections={taxData.projections} />
        </CardBody>
      </Card>

      {/* Discrete tax events */}
      <Card>
        <CardHeader
          title="Discrete Tax Events"
          description="Ranked by estimated tax impact across carry realizations, LP distributions, and real estate sales"
        />
        <CardBody>
          <TaxEventTable projections={taxData.projections} />
        </CardBody>
      </Card>
    </div>
  );
}
