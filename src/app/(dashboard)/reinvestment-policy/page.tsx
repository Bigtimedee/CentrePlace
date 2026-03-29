import { PageHeader } from "@/components/layout/page-header";
import { ReinvestmentPolicyPanel } from "@/components/portfolios/reinvestment-policy-panel";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function ReinvestmentPolicyPage() {
  return (
    <div>
      <PageHeader
        title="Reinvestment Policy"
        description="Define how carry distributions and LP proceeds are redeployed into your portfolio"
      />
      <div className="mt-8">
        <ReinvestmentPolicyPanel />
      </div>
      <NextSectionBanner
        href="/real-estate"
        label="Real Estate"
        description="Properties with full amortization, rental income, and sale projections"
      />
    </div>
  );
}
