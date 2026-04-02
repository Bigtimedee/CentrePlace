"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { LegislationBill } from "@/server/trpc/routers/legislation";

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

function StatusBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    "Introduced": "bg-slate-100 text-slate-600",
    "In Committee": "bg-slate-100 text-slate-600",
    "Passed House": "bg-amber-50 text-amber-700 border border-amber-200",
    "Passed Senate": "bg-orange-50 text-orange-700 border border-orange-200",
    "Enacted": "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
  const cls = classMap[status] ?? "bg-[#FFF3D8] text-[#C8A45A] border border-[#D4B896]";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

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

function BillRow({ bill }: { bill: LegislationBill }) {
  const [expanded, setExpanded] = useState(false);
  const billLabel = `${bill.billType.toUpperCase()} ${bill.billNumber}`;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-mono font-medium text-slate-500">{billLabel}</span>
            <StatusBadge status={bill.status} />
            {bill.topicTags.map((tag) => (
              <TopicTag key={tag} tag={tag} />
            ))}
          </div>
          <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">{bill.title}</p>
        </div>
        <div className="shrink-0 mt-0.5 text-slate-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-2 text-sm text-slate-600 bg-slate-50">
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
      ) : !data?.bills || data.bills.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-slate-500">No pending legislation found for tracked topics.</p>
        </div>
      ) : (
        <div>
          <div className="px-4 py-2 border-b border-gray-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              {data.bills.length} bill{data.bills.length === 1 ? "" : "s"} found — updated from Congress.gov
            </p>
          </div>
          {data.bills.map((bill) => (
            <BillRow key={bill.billId} bill={bill} />
          ))}
        </div>
      )}
    </div>
  );
}
