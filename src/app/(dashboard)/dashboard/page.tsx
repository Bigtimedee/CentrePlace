import { PageHeader } from "@/components/layout/page-header";
import { FISummaryCard } from "@/components/forms/fi-summary-card";
import { IncomeGapCard } from "@/components/dashboard/income-gap-card";
import { SimulationDashboard } from "@/components/dashboard/simulation-dashboard";
import { WithdrawalPlanCard } from "@/components/forms/withdrawal-plan-card";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your financial independence projection"
      />
      <div className="mt-8 space-y-6">
        <FISummaryCard />
        <IncomeGapCard />
        <SimulationDashboard />
        <WithdrawalPlanCard />
      </div>
    </div>
  );
}
