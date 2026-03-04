import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/forms/profile-form";
import { NextSectionBanner } from "@/components/layout/next-section-banner";

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="Profile" description="Filing status, state of residence, simulation assumptions, and family" />
      <div className="mt-8">
        <ProfileForm />
      </div>
      <NextSectionBanner
        href="/income"
        label="Income"
        description="W-2 salary and bonus — bridge income until financial independence"
      />
    </div>
  );
}
