import { PageHeader } from "@/components/layout/page-header";
import { PortfoliosForm } from "@/components/forms/portfolios-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";
import { PortfolioAllocationDashboard } from "@/components/portfolios/portfolio-allocation-dashboard";
import { HoldingsPanelsList } from "@/components/portfolios/holdings-panels-list";
import { DirectInvestmentsForm } from "@/components/portfolios/direct-investments-form";
import { CryptoHoldingsForm } from "@/components/portfolios/crypto-holdings-form";
import { PlaidConnectionPanel } from "@/components/portfolios/plaid-connection-panel";
import { PortfolioIntelligencePanel } from "@/components/portfolios/portfolio-intelligence-panel";
import { HoldingRecommendationsPanel } from "@/components/portfolios/holding-recommendations-panel";

export default function PortfoliosPage() {
  return (
    <div>
      <PageHeader title="Investment Portfolios" description="Taxable accounts, IRAs, 401(k)s — with asset allocation and return assumptions" />
      <div className="mt-8 space-y-6">
        <PlaidConnectionPanel />
        <PortfolioAllocationDashboard />
        <PortfolioIntelligencePanel />
        <PortfoliosForm />
        <HoldingsPanelsList />
        <HoldingRecommendationsPanel />
        <DirectInvestmentsForm />
        <CryptoHoldingsForm />
      </div>
      <NextSectionBanner
        href="/reinvestment-policy"
        label="Reinvestment Policy"
        description="Control how carry and LP proceeds are reinvested — self-directed or guided by your allocation profile"
      />
    </div>
  );
}
