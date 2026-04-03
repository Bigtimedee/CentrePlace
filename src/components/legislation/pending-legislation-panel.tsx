"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { LegislationBill } from "@/server/trpc/routers/legislation";

// ─── Stage pipeline ───────────────────────────────────────────────────────────

const STAGES = ["Introduced", "In Committee", "Passed House", "Passed Senate", "Enacted"] as const;

const STAGE_INDEX: Record<string, number> = {
  "Introduced": 0,
  "In Committee": 1,
  "Passed House": 2,
  "Passed Senate": 3,
  "Enacted": 4,
};

// ─── Urgency config ───────────────────────────────────────────────────────────

interface UrgencyConfig {
  tier: "monitor" | "review" | "act" | "enacted";
  label: string;
  callout: string;
  badgeCls: string;
  calloutCls: string;
  dotCls: string;
  lineCls: string;
  icon: typeof AlertTriangle;
}

const URGENCY: Record<string, UrgencyConfig> = {
  "Introduced": {
    tier: "monitor",
    label: "Monitoring",
    callout: "",
    badgeCls: "bg-slate-100 text-slate-600",
    calloutCls: "",
    dotCls: "bg-slate-400",
    lineCls: "bg-slate-300",
    icon: Info,
  },
  "In Committee": {
    tier: "monitor",
    label: "Monitoring",
    callout: "",
    badgeCls: "bg-slate-100 text-slate-600",
    calloutCls: "",
    dotCls: "bg-slate-400",
    lineCls: "bg-slate-300",
    icon: Info,
  },
  "Passed House": {
    tier: "review",
    label: "Review",
    callout: "Passed the House — consider reviewing your tax strategy with your advisor.",
    badgeCls: "bg-amber-50 text-amber-700 border border-amber-200",
    calloutCls: "bg-amber-50 border-amber-200 text-amber-800",
    dotCls: "bg-amber-400",
    lineCls: "bg-amber-200",
    icon: Info,
  },
  "Passed Senate": {
    tier: "act",
    label: "Act Soon",
    callout: "Passed both chambers — awaiting presidential signature. Consult your advisor now.",
    badgeCls: "bg-orange-50 text-orange-700 border border-orange-200",
    calloutCls: "bg-orange-50 border-orange-200 text-orange-800",
    dotCls: "bg-orange-500",
    lineCls: "bg-orange-200",
    icon: AlertTriangle,
  },
  "Enacted": {
    tier: "enacted",
    label: "Law in Effect",
    callout: "Signed into law — this bill is now in effect. Action may be required.",
    badgeCls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    calloutCls: "bg-emerald-50 border-emerald-200 text-emerald-800",
    dotCls: "bg-emerald-500",
    lineCls: "bg-emerald-200",
    icon: CheckCircle2,
  },
};

const URGENCY_SORT_ORDER: Record<string, number> = {
  "Enacted": 0,
  "Passed Senate": 1,
  "Passed House": 2,
  "In Committee": 3,
  "Introduced": 4,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface PendingLegislationPanelProps {
  topics: string[];
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
    </div>
  );
}

// ─── Pipeline stepper ─────────────────────────────────────────────────────────

function PipelineProgress({ status }: { status: string }) {
  const currentIndex = STAGE_INDEX[status] ?? 0;
  const urgency = URGENCY[status] ?? URGENCY["Introduced"];

  return (
    <div className="mt-2.5 mb-1">
      {/* Dots + lines */}
      <div className="flex items-center">
        {STAGES.map((stage, i) => {
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;

          let dotCls: string;
          if (isCurrent) {
            dotCls = `${urgency.dotCls} ring-2 ring-white ring-offset-1 shadow-sm`;
          } else if (isPast) {
            dotCls = urgency.dotCls + " opacity-40";
          } else {
            dotCls = "bg-slate-200 border border-slate-300";
          }

          const lineCls = i < currentIndex ? urgency.lineCls : "bg-slate-200";

          return (
            <div key={stage} className="flex items-center" style={{ flex: i < STAGES.length - 1 ? "1 1 0%" : "0 0 auto" }}>
              <div
                className={`h-3 w-3 rounded-full shrink-0 ${dotCls}`}
                title={stage}
              />
              {i < STAGES.length - 1 && (
                <div className={`h-0.5 flex-1 mx-0.5 ${lineCls}`} />
              )}
            </div>
          );
        })}
      </div>
      {/* Stage labels */}
      <div className="flex mt-1" style={{ justifyContent: "space-between" }}>
        {STAGES.map((stage, i) => {
          const isCurrent = i === currentIndex;
          return (
            <span
              key={stage}
              className={`text-[10px] leading-tight ${
                isCurrent
                  ? `font-semibold ${urgency.dotCls.replace("bg-", "text-").replace("-400", "-600").replace("-500", "-700")}`
                  : "text-slate-400"
              }`}
              style={{ width: `${100 / STAGES.length}%`, textAlign: i === 0 ? "left" : i === STAGES.length - 1 ? "right" : "center" }}
            >
              {stage}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Urgency callout ─────────────────────────────────────────────────────────

function UrgencyCallout({ status }: { status: string }) {
  const urgency = URGENCY[status];
  if (!urgency?.callout) return null;
  const Icon = urgency.icon;

  return (
    <div className={`flex items-start gap-2 rounded-md border px-3 py-2 mt-2 ${urgency.calloutCls}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <p className="text-xs leading-relaxed">{urgency.callout}</p>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const urgency = URGENCY[status];
  const cls = urgency?.badgeCls ?? "bg-[#FFF3D8] text-[#C8A45A] border border-[#D4B896]";
  const label = urgency?.label ?? status;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Topic tag ────────────────────────────────────────────────────────────────

function TopicTag({ tag }: { tag: string }) {
  const labels: Record<string, string> = {
    "qoz": "QOZ",
    "tcja": "TCJA",
    "estate-tax": "Estate Tax",
    "capital-gains": "Capital Gains",
    "niit": "NIIT",
    "carried-interest": "Carried Interest",
    "section-1031": "1031 Exchange",
    "amt": "AMT",
    "small-business": "Small Business",
    "bonus-depreciation": "Depreciation",
  };
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {labels[tag] ?? tag}
    </span>
  );
}

// ─── Bill row ─────────────────────────────────────────────────────────────────

function BillRow({ bill }: { bill: LegislationBill }) {
  const [expanded, setExpanded] = useState(false);
  const billLabel = `${bill.billType.toUpperCase()} ${bill.billNumber}`;
  const urgency = URGENCY[bill.status] ?? URGENCY["Introduced"];

  // Left accent color for actionable bills
  const accentBorder =
    urgency.tier === "act" ? "border-l-4 border-l-orange-400" :
    urgency.tier === "enacted" ? "border-l-4 border-l-emerald-400" :
    urgency.tier === "review" ? "border-l-4 border-l-amber-300" :
    "";

  return (
    <div className={`border-b border-gray-100 last:border-0 ${accentBorder}`}>
      <button
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          {/* Header row: bill id + status badge + topic tags */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono font-medium text-slate-500">{billLabel}</span>
            <StatusBadge status={bill.status} />
            {bill.topicTags.map((tag) => (
              <TopicTag key={tag} tag={tag} />
            ))}
          </div>
          {/* Title */}
          <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">{bill.title}</p>
          {/* Pipeline progress — always visible */}
          <PipelineProgress status={bill.status} />
          {/* Urgency callout — visible without expanding */}
          <UrgencyCallout status={bill.status} />
        </div>
        <div className="shrink-0 mt-0.5 text-slate-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-2 text-sm text-slate-600 bg-slate-50 border-t border-gray-100">
          {bill.sponsorName && (
            <p><span className="font-medium text-slate-700">Sponsor:</span> {bill.sponsorName}</p>
          )}
          {bill.introducedDate && (
            <p><span className="font-medium text-slate-700">Introduced:</span> {bill.introducedDate}</p>
          )}
          {bill.latestAction && (
            <p>
              <span className="font-medium text-slate-700">Latest action</span>
              {bill.latestActionDate ? ` (${bill.latestActionDate})` : ""}
              {": "}
              {bill.latestAction}
            </p>
          )}
          {bill.summary && (
            <p className="text-slate-600 leading-relaxed">{bill.summary}</p>
          )}
          {bill.url && (
            <a
              href={bill.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#C8A45A] hover:underline font-medium"
            >
              View on Congress.gov <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Urgency summary bar ──────────────────────────────────────────────────────

function UrgencySummary({ bills }: { bills: LegislationBill[] }) {
  const enacted = bills.filter((b) => b.status === "Enacted").length;
  const actSoon = bills.filter((b) => b.status === "Passed Senate").length;
  const review = bills.filter((b) => b.status === "Passed House").length;
  const monitoring = bills.filter(
    (b) => b.status === "Introduced" || b.status === "In Committee"
  ).length;

  if (enacted === 0 && actSoon === 0 && review === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2.5 bg-slate-50 border-b border-gray-100">
      {enacted > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="h-3 w-3" />
          {enacted} law{enacted > 1 ? "s" : ""} in effect
        </span>
      )}
      {actSoon > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-800">
          <AlertTriangle className="h-3 w-3" />
          {actSoon} — act soon
        </span>
      )}
      {review > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
          <Info className="h-3 w-3" />
          {review} — under review
        </span>
      )}
      {monitoring > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
          {monitoring} monitoring
        </span>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function PendingLegislationPanel({ topics }: PendingLegislationPanelProps) {
  const utils = trpc.useUtils();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading } = trpc.legislation.getPendingTaxBills.useQuery(
    { topics },
    { staleTime: 60_000 }
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await utils.client.legislation.refreshLegislation.mutate({ topics });
      await utils.legislation.getPendingTaxBills.invalidate({ topics });
    } finally {
      setIsRefreshing(false);
    }
  }

  // Sort bills by urgency tier (Enacted first, then Passed Senate, etc.)
  const sortedBills = data?.bills
    ? [...data.bills].sort(
        (a, b) => (URGENCY_SORT_ORDER[a.status] ?? 99) - (URGENCY_SORT_ORDER[b.status] ?? 99)
      )
    : [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500">
            <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 1a6 6 0 100 12A6 6 0 0010 1zm-.75 3.75a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Federal Legislation Monitor</h2>
            <p className="text-xs text-slate-500">Pending bills that may impact your tax planning</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          aria-label="Refresh legislation data"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Body */}
      {isLoading ? (
        <Spinner />
      ) : data?.apiKeyMissing ? (
        <div className="px-6 py-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800 mb-1">Congress.gov API key required</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              To enable live legislation tracking, add a free API key to your environment.
              Register at{" "}
              <span className="font-mono bg-amber-100 px-1 rounded">api.data.gov/signup</span>
              {" "}then add{" "}
              <span className="font-mono bg-amber-100 px-1 rounded">CONGRESS_API_KEY=your_key</span>
              {" "}to your{" "}
              <span className="font-mono bg-amber-100 px-1 rounded">.env.local</span> file.
            </p>
          </div>
        </div>
      ) : sortedBills.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-slate-500">No pending legislation found for tracked topics.</p>
        </div>
      ) : (
        <div>
          <div className="px-4 py-2 border-b border-gray-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              {sortedBills.length} bill{sortedBills.length === 1 ? "" : "s"} found — sorted by urgency — updated from Congress.gov
            </p>
          </div>
          <UrgencySummary bills={sortedBills} />
          {sortedBills.map((bill) => (
            <BillRow key={bill.billId} bill={bill} />
          ))}
        </div>
      )}
    </div>
  );
}
