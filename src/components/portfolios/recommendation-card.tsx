"use client";

import { ChevronDown } from "lucide-react";
import type { HoldingRecommendation, Citation } from "@/server/portfolios/recommendation-engine";

type Props = {
  rec: HoldingRecommendation;
  isExpanded: boolean;
  onToggle: () => void;
};

function actionBadgeClasses(action: HoldingRecommendation["action"]): string {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide";
  switch (action) {
    case "INCREASE":
      return `${base} bg-green-100 text-green-800`;
    case "DECREASE":
      return `${base} bg-amber-100 text-amber-800`;
    case "HOLD":
      return `${base} bg-slate-100 text-slate-600`;
    case "REPLACE":
      return `${base} bg-blue-100 text-blue-800`;
    case "SELL":
      return `${base} bg-red-100 text-red-700`;
    default:
      return `${base} bg-slate-100 text-slate-600`;
  }
}

function urgencyBorderClasses(urgency: HoldingRecommendation["urgency"]): string {
  switch (urgency) {
    case "high":
      return "border border-slate-200 border-l-4 border-l-red-500";
    case "medium":
      return "border border-slate-200 border-l-4 border-l-amber-400";
    default:
      return "border border-slate-200";
  }
}

function urgencyLabel(urgency: HoldingRecommendation["urgency"]): string {
  switch (urgency) {
    case "high":
      return "High urgency";
    case "medium":
      return "Medium urgency";
    default:
      return "Low urgency";
  }
}

function CitationBlock({ citation }: { citation: Citation }) {
  return (
    <div className="space-y-1">
      <p>
        {citation.sourceUrl ? (
          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-blue-700 hover:underline"
          >
            {citation.bookTitle}
          </a>
        ) : (
          <span className="text-sm font-semibold text-slate-800">{citation.bookTitle}</span>
        )}
        <span className="text-sm text-slate-500"> — {citation.author}</span>
      </p>
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 mt-0.5">
        {citation.principle}
      </span>
      <blockquote className="border-l-2 border-slate-200 pl-3 text-xs text-slate-500 italic leading-relaxed mt-1">
        {citation.relevantExcerpt}
      </blockquote>
    </div>
  );
}

export function RecommendationCard({ rec, isExpanded, onToggle }: Props) {
  const cardBodyId = `rec-body-${rec.holdingId}`;

  return (
    <div
      className={`rounded-lg bg-white overflow-hidden transition-shadow hover:shadow-md ${urgencyBorderClasses(rec.urgency)}`}
    >
      {/* Collapsed row — clickable toggle */}
      <button
        type="button"
        className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none w-full text-left"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={cardBodyId}
      >
        <span className="sr-only">{urgencyLabel(rec.urgency)}</span>
        <span className={actionBadgeClasses(rec.action)}>{rec.action}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {rec.securityName}
            {rec.ticker && (
              <span className="text-sm font-mono text-slate-500 ml-1">({rec.ticker})</span>
            )}
          </p>
          <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{rec.shortRationale}</p>
          {(rec.action === "REPLACE" || rec.action === "SELL") && rec.alternativeTicker && (
            <p className="text-xs text-slate-400 mt-1">
              {String.fromCharCode(8594)} Consider: {rec.alternativeTicker}
              {rec.alternativeSecurityName ? ` — ${rec.alternativeSecurityName}` : ""}
            </p>
          )}
        </div>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0 mt-0.5${isExpanded ? " rotate-180" : ""}`}
        />
      </button>

      {/* Expanded content */}
      <div
        id={cardBodyId}
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out${isExpanded ? " max-h-[1000px]" : " max-h-0"}`}
      >
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-4">
          {/* Full rationale */}
          <p className="text-sm text-slate-700 leading-relaxed">{rec.fullRationale}</p>

          {/* Alternative row for REPLACE */}
          {rec.action === "REPLACE" && rec.alternativeTicker && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-sm">
              <span className="font-medium text-blue-800">Alternative:</span>
              <span className="font-mono font-semibold text-blue-900">{rec.alternativeTicker}</span>
              {rec.alternativeSecurityName && (
                <>
                  <span className="text-blue-700">&mdash;</span>
                  <span className="text-blue-700">{rec.alternativeSecurityName}</span>
                </>
              )}
            </div>
          )}

          {/* Citations */}
          {rec.citations.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Supporting Research
              </p>
              <div className="space-y-3">
                {rec.citations.map((citation, idx) => (
                  <CitationBlock key={idx} citation={citation} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
