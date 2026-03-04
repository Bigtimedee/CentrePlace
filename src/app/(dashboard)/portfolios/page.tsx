import { PageHeader } from "@/components/layout/page-header";
import { PortfoliosForm } from "@/components/forms/portfolios-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function PortfoliosPage() {
  return (
    <div>
      <PageHeader title="Investment Portfolios" description="Taxable accounts, IRAs, 401(k)s — with asset allocation and return assumptions" />
      <div className="mt-8">
        <PortfoliosForm />
      </div>
      <NextSectionBanner
        href="/real-estate"
        label="Real Estate"
        description="Properties with full amortization, rental income, and sale projections"
      />
    </div>
  );
}
