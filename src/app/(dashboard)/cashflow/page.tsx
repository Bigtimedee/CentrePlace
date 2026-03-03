import { PageHeader } from "@/components/layout/page-header";
import { CashflowCenter } from "@/components/cashflow/cashflow-center";

export default function CashflowPage() {
  return (
    <div>
      <PageHeader
        title="Liquidity Timeline"
        description="Cash arrival schedule across carry, LP distributions, real estate, and income — net after estimated tax"
      />
      <div className="mt-8">
        <CashflowCenter />
      </div>
    </div>
  );
}
