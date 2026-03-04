import { PageHeader } from "@/components/layout/page-header";
import { IncomeForm } from "@/components/forms/income-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function IncomePage() {
  return (
    <div>
      <PageHeader title="Income" description="W-2 salary and bonus — bridge income until financial independence" />
      <div className="mt-8">
        <IncomeForm />
      </div>
      <NextSectionBanner
        href="/carry"
        label="Carry"
        description="GP carried interest positions and waterfall projections across all funds"
      />
    </div>
  );
}
