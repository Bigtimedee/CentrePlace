import { PageHeader } from "@/components/layout/page-header";
import { LPInvestmentsForm } from "@/components/forms/lp-investments-form";

export default function LPInvestmentsPage() {
  return (
    <div>
      <PageHeader title="LP Investments" description="Limited partner positions with expected distribution schedules" />
      <div className="mt-8">
        <LPInvestmentsForm />
      </div>
    </div>
  );
}
