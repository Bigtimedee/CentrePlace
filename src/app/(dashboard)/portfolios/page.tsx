import { PageHeader } from "@/components/layout/page-header";
import { PortfoliosForm } from "@/components/forms/portfolios-form";
import { RealizationPolicyForm } from "@/components/forms/realization-policy-form";
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
      <div className="mt-8 space-y-6">
        <PortfolioAllocationDashboard />
        <PlaidConnectionPanel />
        <PortfoliosForm />
        <HoldingsPanelsList />
        <DirectInvestmentsForm />
        <CryptoHoldingsForm />
        <RealizationPolicyForm />
      </div>
      <NextSectionBanner
        href="/real-estate"
        label="Real Estate"
        description="Properties with full amortization, rental income, and sale projections"
      />
    </div>
  );
}
