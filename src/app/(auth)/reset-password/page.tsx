import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthFormSkeleton, AuthShell } from "@/components/auth/auth-shell";
import { FormError } from "@/components/auth/form-bits";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <AuthShell title="Set a new password">
      <Suspense fallback={<AuthFormSkeleton />}>
        <ResetContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function ResetContent({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token, error } = await searchParams;
  if (typeof token !== "string" || !token || error) {
    return (
      <div className="space-y-4">
        <FormError message="This reset link has expired or was already used." />
        <Link href="/forgot-password" className="font-medium underline underline-offset-4">
          Request a new link
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
