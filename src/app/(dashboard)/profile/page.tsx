import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/forms/profile-form";

export default function ProfilePage() {
  return (
    <div>
      <PageHeader title="Profile" description="Filing status, state of residence, simulation assumptions, and family" />
      <div className="mt-8">
        <ProfileForm />
      </div>
    </div>
  );
}
