import { PageHeader } from "@/components/layout/page-header";
import { ActionPlanCenter } from "@/components/plan/action-plan-center";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function PlanPage() {
  return (
    <div>
      <PageHeader
        title="Annual Action Plan"
        description="Ranked, dollar-quantified action items synthesized from your tax, estate, carry, LP, and FI data"
      />
      <div className="mt-8">
        <ActionPlanCenter />
      </div>
      <NextSectionBanner
        href="/portfolio-analysis"
        label="Portfolio Analysis"
        description="AI-powered intelligence, income opportunities, and holding recommendations for your investment portfolios"
      />
    </div>
  );
}
