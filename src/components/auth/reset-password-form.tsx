"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { fieldErrors, passwordSchema } from "@/lib/validation/auth";
import { FormError, FormSuccess, PasswordField, SubmitButton, authErrorMessage } from "./form-bits";

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function ResetPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});

    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: parsed.data.password, token });
    setPending(false);
    if (error) return setFormError(authErrorMessage(error));
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4">
        <FormSuccess message="Password changed. You've been logged out on other devices." />
        <Link href="/login" className="font-medium underline underline-offset-4">
          Log in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <PasswordField id="password" name="password" label="New password" autoComplete="new-password" hint="At least 8 characters" error={errors.password} />
      <PasswordField id="confirm" name="confirm" label="Repeat new password" autoComplete="new-password" error={errors.confirm} />
      <FormError message={formError} />
      <SubmitButton pending={pending}>Set new password</SubmitButton>
    </form>
  );
}
