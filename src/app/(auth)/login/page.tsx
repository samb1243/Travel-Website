import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthFormSkeleton, AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { OrDivider } from "@/components/auth/form-bits";
import { googleEnabled } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to see your trips and bookings."
      footer={
        <>
          New to TripStack?{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
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
      <LoginForm next={nextPath} />
    </div>
  );
}
