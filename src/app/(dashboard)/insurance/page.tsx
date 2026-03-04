import { PageHeader } from "@/components/layout/page-header";
import { InsuranceForm } from "@/components/forms/insurance-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function InsurancePage() {
  return (
    <div>
      <PageHeader title="Insurance" description="Term, whole life, and PPLI — used in withdrawal sequencing and estate planning" />
      <div className="mt-8">
        <InsuranceForm />
      </div>
      <NextSectionBanner
        href="/expenditures"
        label="Expenditures"
        description="Recurring annual expenses and one-time future spending events"
      />
    </div>
  );
}
