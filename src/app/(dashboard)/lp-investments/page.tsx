import { PageHeader } from "@/components/layout/page-header";
import { LPInvestmentsForm } from "@/components/forms/lp-investments-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function LPInvestmentsPage() {
  return (
    <div>
      <PageHeader title="LP Investments" description="Limited partner positions with expected distribution schedules" />
      <div className="mt-8">
        <LPInvestmentsForm />
      </div>
      <NextSectionBanner
        href="/cashflow"
        label="Liquidity Timeline"
        description="Cash arrival schedule across carry, LP distributions, real estate, and income"
      />
    </div>
  );
}
