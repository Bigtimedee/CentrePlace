"use client";

import { trpc } from "@/lib/trpc";
import { HoldingsBreakdownChart } from "./holdings-breakdown-chart";
import { HoldingsTable } from "./holdings-table";

interface Props {
  accountId: string;
  accountName: string;
}

export function AccountHoldingsPanel({ accountId, accountName }: Props) {
  const { data: statements, refetch } = trpc.portfolios.getHoldings.useQuery({ accountId });

  const latestStatement = statements?.[0];
  const holdings = latestStatement?.holdings ?? [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Account header bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-gray-100">
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
        {holdings.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 italic">
              No holdings imported yet. Upload a statement or add holdings manually.
            </p>
            <HoldingsTable accountId={accountId} holdings={[]} onRefetch={refetch} />
          </div>
        ) : (
          <>
            <HoldingsBreakdownChart holdings={holdings} />
            <div className="mt-4">
              <HoldingsTable
                accountId={accountId}
                holdings={holdings}
                onRefetch={refetch}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
