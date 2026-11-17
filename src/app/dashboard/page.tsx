import type { Metadata } from "next";
import { LuggageIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "My trips" };

// Placeholder until step 4 (dashboard).
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">My trips</h1>
      <EmptyState icon={LuggageIcon} title="No trips yet">
        Your trips will show up here. Creating trips arrives in a later build step.
      </EmptyState>
    </div>
  );
}
