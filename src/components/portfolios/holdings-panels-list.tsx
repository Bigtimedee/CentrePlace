"use client";

import { trpc } from "@/lib/trpc";
import { AccountHoldingsPanel } from "./account-holdings-panel";

export function HoldingsPanelsList() {
  const { data: accounts = [] } = trpc.portfolios.list.useQuery();

  if (accounts.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Holdings by Account</h3>
      {accounts.map((acct) => (
        <AccountHoldingsPanel
          key={acct.id}
          accountId={acct.id}
          accountName={acct.accountName}
        />
      ))}
    </div>
  );
}
