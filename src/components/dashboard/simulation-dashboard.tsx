"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardBody } from "@/components/ui/card";
import { CapitalProjectionChart } from "./capital-projection-chart";
import { CapitalBucketsChart } from "./capital-buckets-chart";
import { AnnualCashflowChart } from "./annual-cashflow-chart";
import { AnnualSummaryTable } from "./annual-summary-table";
import { AlertCircle, RefreshCw } from "lucide-react";
import Link from "next/link";

export function SimulationDashboard() {
  const { data, isLoading, error, refetch, isFetching } = trpc.simulation.run.useQuery(undefined, {
    retry: false,
    staleTime: 120_000,
  });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card>
        <CardBody>
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-600">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Running 40-year simulation…</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    const isProfileMissing = error?.message?.includes("Profile not found");
    return (
      <Card>
        <CardBody>
          <div className="flex items-start gap-3 text-amber-400">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              {isProfileMissing ? (
                <>
                  Complete your{" "}
                  <Link href="/profile" className="underline hover:text-amber-300">profile</Link>
                  {" "}to generate your FI projection.
                </>
              ) : (
                "Unable to run simulation. Ensure your profile is complete."
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  // ── Charts ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Capital Projection — primary chart, full width */}
      <Card>
        <CardBody>
          <CapitalProjectionChart result={data} />
        </CardBody>
      </Card>

      {/* Two-column: buckets + cash flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <CapitalBucketsChart quarters={data.quarters} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <AnnualCashflowChart quarters={data.quarters} />
          </CardBody>
        </Card>
      </div>

      {/* Milestone snapshot table */}
      <Card>
        <CardBody>
          <AnnualSummaryTable result={data} />
        </CardBody>
      </Card>

      {/* Refresh + data-freshness note */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          Refresh projection
        </button>
      </div>
    </div>
  );
}
