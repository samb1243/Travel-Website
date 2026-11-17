"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { fieldErrors, logInSchema } from "@/lib/validation/auth";
import { Field, FormError, PasswordField, SubmitButton, authErrorMessage } from "./form-bits";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = logInSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});

    setPending(true);
    const { error } = await authClient.signIn.email({ ...parsed.data, rememberMe: true });
    if (error) {
      setPending(false);
      return setFormError(authErrorMessage(error));
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" inputMode="email" error={errors.email} />
      <PasswordField id="password" name="password" label="Password" autoComplete="current-password" error={errors.password} />
      <div className="-mt-1 text-right text-sm">
        <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Forgot password?
        </Link>
      </div>
      <FormError message={formError} />
      <SubmitButton pending={pending}>Log in</SubmitButton>
    </form>
  );
}
