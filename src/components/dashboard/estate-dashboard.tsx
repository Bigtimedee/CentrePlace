"use client";

import { trpc } from "@/lib/trpc";
import { EstateSummaryCard } from "@/components/forms/estate-summary-card";
import { EstateOptimizationsCard } from "@/components/forms/estate-optimizations-card";
import { EstateBreakdownCard } from "@/components/forms/estate-breakdown-card";
import { EstatePlanningCard } from "@/components/forms/estate-planning-card";
import Link from "next/link";

export function EstateDashboard() {
  const { data, isLoading, error } = trpc.estate.summary.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
        <svg className="animate-spin h-5 w-5 mr-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Calculating estate…
      </div>
    );
  }

  if (error) {
    const isProfileMissing = error.data?.code === "PRECONDITION_FAILED";
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
        {isProfileMissing ? (
          <>
            <p className="mb-3">Complete your profile to see the estate summary.</p>
            <Link
              href="/profile"
              className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Go to Profile →
            </Link>
          </>
        ) : (
          <p>Unable to load estate data: {error.message}</p>
        )}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <EstateSummaryCard data={data} />
      <EstateOptimizationsCard recommendations={data.recommendations} />
      <EstateBreakdownCard data={data} />
      <EstatePlanningCard data={data} />
    </div>
  );
}
