import type { Metadata } from "next";
import { UserIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Profile" };

// Placeholder until step 3 (auth and profile).
export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Profile</h1>
      <EmptyState icon={UserIcon} title="You're not signed in">
        Sign-up and log-in arrive in step 3.
      </EmptyState>
    </div>
  );
}
