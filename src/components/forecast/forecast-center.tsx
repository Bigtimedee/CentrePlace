"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardBody } from "@/components/ui/card";
import { ForecastControls } from "./forecast-controls";
import { ForecastSummaryCards } from "./forecast-summary-cards";
import { MonteCarloChart } from "./monte-carlo-chart";
import { FiProbabilityChart } from "./fi-probability-chart";

export function ForecastCenter() {
  const [volatility, setVolatility] = useState(12);
  const [varyCarry, setVaryCarry] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const { data, isLoading, error } = trpc.simulation.monteCarlo.useQuery(
    { returnVolatility: volatility / 100, varyCarryHaircut: varyCarry },
    { enabled: hasRun, staleTime: 120_000, retry: false },
  );

  const isProfileMissing =
    (error as { data?: { code?: string } } | null)?.data?.code === "PRECONDITION_FAILED";

  return (
    <div className="space-y-6">
      <ForecastControls
        volatility={volatility}
        varyCarry={varyCarry}
        onVolatilityChange={setVolatility}
        onVaryCarryChange={setVaryCarry}
        onRun={() => setHasRun(true)}
        isLoading={isLoading}
      />

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
          {isProfileMissing ? (
            <>
              <p className="mb-3">Complete your profile before running the forecast.</p>
              <Link
                href="/profile"
                className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                Go to Profile →
              </Link>
            </>
          ) : (
            <p>Unable to run forecast: {String((error as { message?: string })?.message ?? error)}</p>
          )}
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
          <svg className="animate-spin h-5 w-5 mr-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Running 500 simulations…
        </div>
      )}

      {/* Results */}
      {data && !error && (
        <>
          <ForecastSummaryCards result={data} />

          <Card>
            <CardBody>
              <MonteCarloChart result={data} />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <FiProbabilityChart result={data} />
            </CardBody>
          </Card>

          <p className="text-center text-xs text-slate-600">
            Simulated returns use log-normal distribution. Past volatility does not predict future returns.
          </p>
        </>
      )}

      {/* Idle state */}
      {!hasRun && !error && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-12 text-center text-sm text-slate-500">
          Configure your volatility assumptions above and click{" "}
          <strong className="text-slate-400">Run Forecast</strong> to generate 500 simulated market paths.
        </div>
      )}
    </div>
  );
}
