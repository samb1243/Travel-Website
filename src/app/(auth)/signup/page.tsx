import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFormSkeleton, AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";
import { OrDivider } from "@/components/auth/form-bits";
import { googleEnabled } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthShell
      title="Start planning"
      subtitle="Free account. Keep every trip, booking and link in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Log in
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <SignupContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function SignupContent({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  if (await getCurrentUser()) redirect(nextPath);

  return (
    <div className="space-y-5">
      {googleEnabled ? (
        <>
          <GoogleButton next={nextPath} />
          <OrDivider />
        </>
      ) : null}
      <SignupForm next={nextPath} />
    </div>
  );
}
