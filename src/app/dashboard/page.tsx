import type { Metadata } from "next";
import { Suspense } from "react";
import { LuggageIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "My trips" };

// Trip cards arrive in step 4.
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser("/dashboard");
  const firstName = user.name.split(" ")[0];
  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">Hi {firstName} 👋</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">My trips</h1>
      </div>
      <EmptyState icon={LuggageIcon} title="No trips yet">
        Your trips will show up here. Creating trips arrives in the next build step.
      </EmptyState>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-14 w-48" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
