"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { fieldErrors, signUpSchema } from "@/lib/validation/auth";
import { Field, FormError, PasswordField, SubmitButton, authErrorMessage } from "./form-bits";

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = signUpSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});

    setPending(true);
    const { error } = await authClient.signUp.email(parsed.data);
    if (error) {
      setPending(false);
      return setFormError(authErrorMessage(error));
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="name" name="name" label="Your name" autoComplete="name" error={errors.name} />
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" inputMode="email" error={errors.email} />
      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete="new-password"
        hint="At least 8 characters"
        error={errors.password}
      />
      <FormError message={formError} />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}
