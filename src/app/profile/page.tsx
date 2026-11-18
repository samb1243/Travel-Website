import type { Metadata } from "next";
import { Suspense } from "react";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { ColorSettings } from "@/components/profile/color-settings";
import { cleanCustomColors } from "@/lib/colors";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">Profile</h1>
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile />
      </Suspense>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="font-heading text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

async function Profile() {
  const user = await requireUser("/profile");
  const [accounts, prefs] = await Promise.all([
    db.account.findMany({ where: { userId: user.id }, select: { providerId: true } }),
    db.user.findUnique({ where: { id: user.id }, select: { colors: true } }),
  ]);
  const hasPassword = accounts.some((a) => a.providerId === "credential");
  const hasGoogle = accounts.some((a) => a.providerId === "google");

  return (
    <>
      <Section title="Your details">
        <ProfileForm user={user} />
      </Section>

      <Section title="Colours">
        <ColorSettings saved={cleanCustomColors(prefs?.colors)} />
      </Section>

      <Section title="Sign-in methods">
        <ul className="space-y-2 text-sm">
          {hasPassword ? (
            <li className="flex items-center gap-2">
              <KeyRoundIcon className="size-4 text-muted-foreground" aria-hidden /> Email and password
            </li>
          ) : null}
          {hasGoogle ? (
            <li className="flex items-center gap-2">
              <MailIcon className="size-4 text-muted-foreground" aria-hidden /> Google
            </li>
          ) : null}
        </ul>
        {hasPassword ? (
          <div className="border-t pt-4">
            <ChangePasswordForm />
          </div>
        ) : null}
      </Section>

      <SignOutButton size="lg" className="h-12 w-full text-base" />
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <Skeleton className="h-96 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
