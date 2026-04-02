"use client";

import { trpc } from "@/lib/trpc";
import { HoldingsBreakdownChart } from "./holdings-breakdown-chart";
import { HoldingsTable } from "./holdings-table";

interface Props {
  accountId: string;
  accountName: string;
  accountType?: string | null;
}

function AccountStrategyBanner({ accountType }: { accountType?: string | null }) {
  if (!accountType) return null;

  const strategyMap: Record<string, { className: string; guidance: string }> = {
    taxable: {
      className: "bg-[#FFF8EE] text-[#C8A45A]",
      guidance: "Best for: Tax-managed equities, munis, low-turnover index funds",
    },
    traditional_ira: {
      className: "bg-violet-50 text-violet-700",
      guidance: "Best for: Bond funds, REITs, high-turnover funds — shelters ordinary income",
    },
    traditional_401k: {
      className: "bg-violet-50 text-violet-700",
      guidance: "Best for: Bond funds, REITs, high-turnover funds — shelters ordinary income",
    },
    sep_ira: {
      className: "bg-violet-50 text-violet-700",
      guidance: "Best for: Bond funds, REITs, high-turnover funds — shelters ordinary income",
    },
    solo_401k: {
      className: "bg-violet-50 text-violet-700",
      guidance: "Best for: Bond funds, REITs, high-turnover funds — shelters ordinary income",
    },
    roth_ira: {
      className: "bg-emerald-50 text-emerald-700",
      guidance: "Best for: High-growth equities, aggressive positions — tax-free compounding",
    },
    roth_401k: {
      className: "bg-emerald-50 text-emerald-700",
      guidance: "Best for: High-growth equities, aggressive positions — tax-free compounding",
    },
  };

  const strategy = accountType ? strategyMap[accountType] : undefined;
  if (!strategy) return null;

  return (
    <div className={`${strategy.className} text-xs px-3 py-1.5 rounded-lg mb-3`}>
      <span className="font-semibold">Account strategy:</span>{" "}
      <span>{strategy.guidance}</span>
    </div>
  );
}

export function AccountHoldingsPanel({ accountId, accountName, accountType }: Props) {
  const { data: statements, refetch } = trpc.portfolios.getHoldings.useQuery({ accountId });

  const latestStatement = statements?.[0];
  const holdings = latestStatement?.holdings ?? [];

  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm" style={{ borderColor: "#E5E0D8" }}>
      {/* Account header bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#F5F3EE] border-b" style={{ borderColor: "#E5E0D8" }}>
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-slate-400 flex-shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-800">{accountName}</h3>
        </div>
        {latestStatement?.statementDate && (
          <span className="text-xs text-slate-400 tabular-nums">
            Statement {latestStatement.statementDate}
            {latestStatement.brokerageName ? ` · ${latestStatement.brokerageName}` : ""}
          </span>
        )}
      </div>

      {/* Account body */}
      <div className="p-4">
        <AccountStrategyBanner accountType={accountType} />
        {holdings.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm italic" style={{ color: "#9B9188" }}>
              No holdings imported yet — upload a statement or add holdings manually.
            </p>
            <HoldingsTable accountId={accountId} holdings={[]} onRefetch={refetch} accountType={accountType} />
          </div>
        ) : (
          <>
            <HoldingsBreakdownChart holdings={holdings} />
            <div className="mt-4">
              <HoldingsTable
                accountId={accountId}
                holdings={holdings}
                onRefetch={refetch}
                accountType={accountType}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
