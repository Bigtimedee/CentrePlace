import { PageHeader } from "@/components/layout/page-header";
import { IncomeForm } from "@/components/forms/income-form";

export default function IncomePage() {
  return (
    <div>
      <PageHeader title="Income" description="W-2 salary and bonus — bridge income until financial independence" />
      <div className="mt-8">
        <IncomeForm />
      </div>
    </div>
  );
}
