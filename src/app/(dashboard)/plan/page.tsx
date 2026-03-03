import { PageHeader } from "@/components/layout/page-header";
import { ActionPlanCenter } from "@/components/plan/action-plan-center";

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
    </div>
  );
}
