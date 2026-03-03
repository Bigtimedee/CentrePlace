import { PageHeader } from "@/components/layout/page-header";
import { ExpendituresForm } from "@/components/forms/expenditures-form";

export default function ExpendituresPage() {
  return (
    <div>
      <PageHeader title="Expenditures" description="Recurring annual expenses and one-time future spending events" />
      <div className="mt-8">
        <ExpendituresForm />
      </div>
    </div>
  );
}
