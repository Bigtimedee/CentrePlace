import { PageHeader } from "@/components/layout/page-header";
import { ExpendituresForm } from "@/components/forms/expenditures-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function ExpendituresPage() {
  return (
    <div>
      <PageHeader title="Expenditures" description="Recurring annual expenses and one-time future spending events" />
      <div className="mt-8">
        <ExpendituresForm />
      </div>
      <NextSectionBanner
        href="/portfolio-analysis"
        label="Portfolio Analysis"
        description="AI-powered intelligence, income opportunities, and holding recommendations for your investment portfolios"
      />
    </div>
  );
}
