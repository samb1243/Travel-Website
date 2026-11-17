"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { emailSchema, fieldErrors } from "@/lib/validation/auth";
import { Field, FormError, FormSuccess, SubmitButton, authErrorMessage } from "./form-bits";

const schema = z.object({ email: emailSchema });

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});

    setPending(true);
    const { error } = await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error) return setFormError(authErrorMessage(error));
    // Same message whether or not the account exists, so emails can't be probed.
    setSent(true);
  }

  if (sent) {
    return (
      <FormSuccess message="If an account exists for that email, a reset link is on its way. It's valid for 1 hour." />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" inputMode="email" error={errors.email} />
      <FormError message={formError} />
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}
