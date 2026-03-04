import { PageHeader } from "@/components/layout/page-header";
import { TaxCenter } from "@/components/tax/tax-center";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function TaxPage() {
  return (
    <div>
      <PageHeader
        title="Tax Planning"
        description="Projected tax liability, bracket analysis, and carry timing optimization"
      />
      <div className="mt-8">
        <TaxCenter />
      </div>
      <NextSectionBanner
        href="/plan"
        label="Action Plan"
        description="Ranked, dollar-quantified next steps toward financial independence"
      />
    </div>
  );
}
