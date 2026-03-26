"use client";

import { useState } from "react";
import { TRPCClientError } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { RecommendationCard } from "./recommendation-card";
import type { HoldingRecommendation } from "@/server/portfolios/recommendation-engine";

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterValue = "all" | "high" | "INCREASE" | "DECREASE" | "REPLACE" | "SELL" | "HOLD";
type SortValue = "urgency" | "action" | "name";

const URGENCY_ORDER: Record<HoldingRecommendation["urgency"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function toHoldingRecommendation(r: {
  holdingId: string;
  ticker: string | null;
  securityName: string;
  action: string;
  targetAllocationNote: string;
  alternativeTicker: string | null;
  alternativeSecurityName: string | null;
  shortRationale: string;
  fullRationale: string;
  citations: unknown;
  urgency: string;
}): HoldingRecommendation {
  return {
    holdingId: r.holdingId,
    ticker: r.ticker ?? null,
    securityName: r.securityName,
    action: r.action as HoldingRecommendation["action"],
    targetAllocationNote: r.targetAllocationNote,
    alternativeTicker: r.alternativeTicker ?? undefined,
    alternativeSecurityName: r.alternativeSecurityName ?? undefined,
    shortRationale: r.shortRationale,
    fullRationale: r.fullRationale,
    citations: Array.isArray(r.citations)
      ? (r.citations as HoldingRecommendation["citations"])
      : [],
    urgency: r.urgency as HoldingRecommendation["urgency"],
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InlineSpinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden animate-pulse">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="h-5 w-16 rounded-full bg-slate-200" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-4 w-48 rounded bg-slate-200" />
          <div className="h-3 w-72 rounded bg-slate-100" />
          <div className="h-3 w-56 rounded bg-slate-100" />
        </div>
        <div className="h-4 w-4 rounded bg-slate-200 ml-auto" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function HoldingRecommendationsPanel() {
  // freshRecs holds recommendations returned from the generate mutation in this session.
  // When null, the panel falls back to storedRecs from the DB query.
  const [freshRecs, setFreshRecs] = useState<HoldingRecommendation[] | null>(null);
  const [lastPriceRefresh, setLastPriceRefresh] = useState<Date | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [sortBy, setSortBy] = useState<SortValue>("urgency");

  // Hydrate from DB on mount
  const { data: storedRecs, isLoading: isQueryLoading } =
    trpc.portfolios.getRecommendations.useQuery(undefined, { staleTime: 120_000 });

  const refreshPricesMutation = trpc.portfolios.refreshPrices.useMutation({
    onSuccess: (data) => {
      setLastPriceRefresh(data.refreshedAt);
      setIsRefreshingPrices(false);
    },
    onError: () => {
      setError("Failed to refresh prices. Please try again.");
      setIsRefreshingPrices(false);
    },
  });

  const generateMutation = trpc.portfolios.generateRecommendations.useMutation({
    onSuccess: (data) => {
      setFreshRecs(data);
      setIsGenerating(false);
    },
    onError: (err) => {
      const isBadRequest =
        err instanceof TRPCClientError && err.data?.httpStatus === 400;
      setError(
        isBadRequest
          ? (err.message ?? "No holdings found. Add holdings to your account first.")
          : "Failed to generate recommendations. Please try again."
      );
      setIsGenerating(false);
    },
  });

  function handleRefreshPrices() {
    setIsRefreshingPrices(true);
    setError(null);
    refreshPricesMutation.mutate();
  }

  function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    setExpandedId(null);
    setActiveFilter("all");
    generateMutation.mutate();
  }

  function handleFilterChange(value: FilterValue) {
    setActiveFilter(value);
    setExpandedId(null);
  }

  function toggleCard(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // Derive the active recommendations: prefer freshly generated over stored
  const recommendations: HoldingRecommendation[] =
    freshRecs ??
    (storedRecs ? storedRecs.map(toHoldingRecommendation) : []);

  // Filtering
  const filtered = recommendations.filter((rec) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "high") return rec.urgency === "high";
    return rec.action === activeFilter;
  });

  // Sorting
  const filteredAndSorted = [...filtered].sort((a, b) => {
    if (sortBy === "urgency") {
      const diff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
      if (diff !== 0) return diff;
      return a.securityName.localeCompare(b.securityName);
    }
    if (sortBy === "action") return a.action.localeCompare(b.action);
    return a.securityName.localeCompare(b.securityName);
  });

  const holdingsCount = recommendations.length;
  const isLoading = isQueryLoading && recommendations.length === 0;
  const hasNoHoldings = !isQueryLoading && storedRecs !== undefined && storedRecs.length === 0 && freshRecs === null;

  const FILTERS: { label: string; value: FilterValue }[] = [
    { label: `All (${holdingsCount})`, value: "all" },
    { label: "High Urgency", value: "high" },
    { label: "INCREASE", value: "INCREASE" },
    { label: "DECREASE", value: "DECREASE" },
    { label: "REPLACE", value: "REPLACE" },
    { label: "SELL", value: "SELL" },
    { label: "HOLD", value: "HOLD" },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Panel header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-slate-900">Portfolio Recommendations</h2>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {holdingsCount} holdings
            </span>
          </div>
          {lastPriceRefresh && (
            <p className="text-xs text-slate-400 mt-0.5">
              Prices last refreshed: {lastPriceRefresh.toLocaleString()}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-0.5">
            Prices sourced from Yahoo Finance (equities) and CoinGecko (crypto)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefreshPrices}
            disabled={isRefreshingPrices || isGenerating}
            aria-label={isRefreshingPrices ? "Refreshing prices..." : "Refresh prices"}
          >
            {isRefreshingPrices && <InlineSpinner />}
            {isRefreshingPrices ? "Refreshing..." : "Refresh Prices"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={isGenerating || isRefreshingPrices || hasNoHoldings}
            aria-label={isGenerating ? "Generating recommendations..." : "Generate recommendations"}
            title={hasNoHoldings ? "Add holdings to your account first" : undefined}
          >
            {isGenerating && <InlineSpinner />}
            {isGenerating ? "Generating..." : "Generate Recommendations"}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-4">
          <svg
            className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5"
            aria-hidden="true"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setError(null);
              if (error.includes("prices")) handleRefreshPrices();
              else handleGenerate();
            }}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && recommendations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="h-12 w-12 text-slate-300 mb-4"
            aria-hidden="true"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
          <p className="text-base font-semibold text-slate-700 mb-1">No recommendations yet</p>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            {hasNoHoldings
              ? "Add holdings to your portfolio accounts first, then generate recommendations."
              : "Refresh your prices and generate recommendations to see actionable insights for your portfolio."}
          </p>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={isGenerating || hasNoHoldings}
            title={hasNoHoldings ? "Add holdings to your account first" : undefined}
          >
            {isGenerating && <InlineSpinner />}
            {isGenerating ? "Generating..." : "Generate Recommendations"}
          </Button>
        </div>
      )}

      {/* Filter and sort bar */}
      {!isLoading && recommendations.length > 0 && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter recommendations">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleFilterChange(f.value)}
                  aria-pressed={activeFilter === f.value}
                  className={
                    activeFilter === f.value
                      ? "inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 cursor-pointer transition-colors duration-150"
                      : "inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 cursor-pointer transition-colors duration-150 hover:bg-slate-50 hover:border-slate-300"
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="rec-sort" className="sr-only">
                Sort recommendations by
              </label>
              <select
                id="rec-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortValue)}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="urgency">Urgency (High first)</option>
                <option value="action">Action Type</option>
                <option value="name">Security Name</option>
              </select>
            </div>
          </div>

          {/* Recommendation cards */}
          <div className="space-y-3">
            {filteredAndSorted.map((rec) => (
              <RecommendationCard
                key={rec.holdingId}
                rec={rec}
                isExpanded={expandedId === rec.holdingId}
                onToggle={() => toggleCard(rec.holdingId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
