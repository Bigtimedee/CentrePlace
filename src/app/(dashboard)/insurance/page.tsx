import { PageHeader } from "@/components/layout/page-header";
import { InsuranceForm } from "@/components/forms/insurance-form";

export default function InsurancePage() {
  return (
    <div>
      <PageHeader title="Insurance" description="Term, whole life, and PPLI — used in withdrawal sequencing and estate planning" />
      <div className="mt-8">
        <InsuranceForm />
      </div>
    </div>
  );
}
