"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency, formatPct } from "@/lib/utils";
import { TrendingUp, Target, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

function MetricTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "amber" | "red" | "indigo";
}) {
  const colors = {
    green: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-rose-400",
    indigo: "text-indigo-400",
  };
  return (
    <div className="bg-slate-800/50 rounded-lg px-4 py-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${accent ? colors[accent] : "text-slate-100"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function FISummaryCard() {
  const { data, isLoading, error } = trpc.simulation.run.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Financial Independence Status" />
        <CardBody>
          <div className="h-24 flex items-center justify-center text-slate-500 text-sm">
            Running simulation…
          </div>
        </CardBody>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader title="Financial Independence Status" />
        <CardBody>
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              {error?.message?.includes("Profile not found")
                ? <>Complete your <Link href="/profile" className="underline">profile</Link> to run a simulation.</>
                : "Unable to run simulation. Check that your profile is complete."}
            </span>
          </div>
        </CardBody>
      </Card>
    );
  }

  const { summary, fiDate, fiAge, currentAge } = data;
  const isFI = summary.gapToFI <= 0;
  const pctFunded = summary.requiredCapitalToday > 0
    ? Math.min(1, summary.totalCapitalToday / summary.requiredCapitalToday)
    : 1;

  return (
    <Card>
      <CardHeader
        title="Financial Independence Status"
        description="Based on your complete financial picture"
        action={
          isFI ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-950/50 border border-emerald-800 rounded-full px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> FI Achieved
            </span>
          ) : null
        }
      />
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <MetricTile
            label="Total Capital"
            value={formatCurrency(summary.totalCapitalToday, true)}
            sub="All buckets combined"
            accent="indigo"
          />
          <MetricTile
            label="Required Capital"
            value={formatCurrency(summary.requiredCapitalToday, true)}
            sub={`${formatPct(pctFunded)} funded`}
          />
          <MetricTile
            label={isFI ? "FI Surplus" : "Gap to FI"}
            value={formatCurrency(Math.abs(summary.gapToFI), true)}
            accent={isFI ? "green" : "amber"}
            sub={isFI ? "Excess capital" : "Still needed"}
          />
          <MetricTile
            label="Annual Spending"
            value={formatCurrency(summary.projectedAnnualSpending)}
            sub={summary.permanentAnnualIncome > 0
              ? `−${formatCurrency(summary.permanentAnnualIncome, true)} rental offset`
              : undefined}
          />
        </div>

        {/* FI date */}
        <div className="flex items-center gap-3 py-3 border-t border-slate-800">
          <Calendar className="h-4 w-4 text-slate-500 flex-shrink-0" />
          {fiDate ? (
            <span className="text-sm text-slate-300">
              Projected FI date:{" "}
              <span className="font-medium text-slate-100">
                {fiDate.quarter} {fiDate.year}
              </span>
              {fiAge && (
                <span className="text-slate-500 ml-2">
                  (age {fiAge} · {fiAge - currentAge > 0 ? `${fiAge - currentAge} years away` : "now"})
                </span>
              )}
            </span>
          ) : (
            <span className="text-sm text-amber-400">
              FI not achieved within the 40-year projection window. Increase savings or reduce spending.
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>FI Progress</span>
            <span>{formatPct(pctFunded)}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isFI ? "bg-emerald-500" : "bg-indigo-500"}`}
              style={{ width: `${Math.round(pctFunded * 100)}%` }}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
