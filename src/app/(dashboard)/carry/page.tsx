import { PageHeader } from "@/components/layout/page-header";
import { CarryForm } from "@/components/forms/carry-form";

export default function CarryPage() {
  return (
    <div>
      <PageHeader title="Carry Positions" description="GP carried interest across all funds — net of haircut and tax" />
      <div className="mt-8">
        <CarryForm />
      </div>
    </div>
  );
}
