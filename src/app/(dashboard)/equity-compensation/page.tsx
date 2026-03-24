import { PageHeader } from "@/components/layout/page-header";
import { EquityCompensationForm } from "@/components/forms/equity-compensation-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function EquityCompensationPage() {
  return (
    <div>
      <PageHeader
        title="Equity Compensation"
        description="RSUs, ISOs, NSOs, warrants, and stock grants — with tax-aware vesting and sale modeling"
      />
      <div className="mt-8 space-y-6">
        <EquityCompensationForm />
      </div>
      <NextSectionBanner
        href="/portfolios"
        label="Investment Portfolios"
        description="Taxable accounts, IRAs, 401(k)s — with asset allocation and return assumptions"
      />
    </div>
  );
}
