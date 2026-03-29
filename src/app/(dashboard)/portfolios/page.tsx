import { PageHeader } from "@/components/layout/page-header";
import { PortfoliosForm } from "@/components/forms/portfolios-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";
import { PortfolioAllocationDashboard } from "@/components/portfolios/portfolio-allocation-dashboard";
import { HoldingsPanelsList } from "@/components/portfolios/holdings-panels-list";
import { DirectInvestmentsForm } from "@/components/portfolios/direct-investments-form";
import { CryptoHoldingsForm } from "@/components/portfolios/crypto-holdings-form";
import { PlaidConnectionPanel } from "@/components/portfolios/plaid-connection-panel";

export default function PortfoliosPage() {
  return (
    <div>
      <PageHeader title="Investment Portfolios" description="Taxable accounts, IRAs, 401(k)s — with asset allocation and return assumptions" />

      {/* ── Section 1: Account setup and holdings data entry ─────────────── */}
      <div className="mt-8 space-y-6">
        <PlaidConnectionPanel />
        <PortfoliosForm />
        <HoldingsPanelsList />
        <DirectInvestmentsForm />
        <CryptoHoldingsForm />
      </div>

      {/* ── Section 2: Allocation analysis (requires holdings to exist) ───── */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Portfolio Analysis</h2>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        <div className="space-y-6">
          <PortfolioAllocationDashboard />
        </div>
      </div>

      <NextSectionBanner
        href="/reinvestment-policy"
        label="Reinvestment Policy"
        description="Control how carry and LP proceeds are reinvested — self-directed or guided by your allocation profile"
      />
    </div>
  );
}
