import Link from "next/link";
import { MapPinOffIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={MapPinOffIcon}
      title="Page not found"
      action={
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      }
    >
      This page doesn&apos;t exist, or it&apos;s a private trip you don&apos;t have access to.
    </EmptyState>
  );
}
