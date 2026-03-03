"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ActionPlanSummaryBar } from "./action-plan-summary-bar";
import { ActionPlanFilters } from "./action-plan-filters";
import { ActionItemList } from "./action-item-list";
import type { ActionCategory } from "@/server/simulation/plan/types";

export function ActionPlanCenter() {
  const [activeCategory, setActiveCategory] = useState<ActionCategory | "all">("all");

  const { data, isLoading, error } = trpc.plan.annual.useQuery(undefined, {
    staleTime: 120_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
        <svg className="animate-spin h-5 w-5 mr-3 text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Synthesizing your action plan…
      </div>
    );
  }

  if (error || !data) {
    const isProfileMissing = error?.data?.code === "PRECONDITION_FAILED";
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
        {isProfileMissing ? (
          <>
            <p className="mb-3">Complete your profile to generate your action plan.</p>
            <Link
              href="/profile"
              className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Go to Profile →
            </Link>
          </>
        ) : (
          <p>Unable to load action plan: {error?.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI tiles + FI progress */}
      <ActionPlanSummaryBar result={data} />

      {/* Category filters */}
      {data.items.length > 0 && (
        <ActionPlanFilters
          items={data.items}
          active={activeCategory}
          onChange={setActiveCategory}
        />
      )}

      {/* Action item list grouped by urgency */}
      {data.items.length > 0 ? (
        <ActionItemList items={data.items} activeCategory={activeCategory} />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
          <p className="text-lg font-semibold text-white mb-2">You&apos;re all set for {data.planYear}</p>
          <p>No action items were generated. Add carry positions, LP investments, or estate data to unlock personalized recommendations.</p>
        </div>
      )}

      <p className="text-xs text-slate-600 leading-relaxed">
        Action items are generated from your entered data using planning heuristics. Dollar impacts are estimates.
        Confirm all actions with your CPA, attorney, and financial advisor before proceeding.
      </p>
    </div>
  );
}
