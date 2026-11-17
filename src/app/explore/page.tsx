import type { Metadata } from "next";
import { CompassIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Explore" };

// Placeholder until step 10 (sharing and Explore).
export default function ExplorePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Explore trips</h1>
      <EmptyState icon={CompassIcon} title="Nothing to explore yet">
        Public trips from other travellers will appear here.
      </EmptyState>
    </div>
  );
}
