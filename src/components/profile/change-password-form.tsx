"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { fieldErrors, passwordSchema } from "@/lib/validation/auth";
import { FormError, PasswordField, SubmitButton, authErrorMessage } from "@/components/auth/form-bits";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setFormError(null);
    const parsed = schema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});

    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) return setFormError(authErrorMessage(error));
    form.reset();
    toast.success("Password changed. Other devices have been logged out.");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <PasswordField id="currentPassword" name="currentPassword" label="Current password" autoComplete="current-password" error={errors.currentPassword} />
      <PasswordField id="newPassword" name="newPassword" label="New password" autoComplete="new-password" hint="At least 8 characters" error={errors.newPassword} />
      <PasswordField id="confirm" name="confirm" label="Repeat new password" autoComplete="new-password" error={errors.confirm} />
      <FormError message={formError} />
      <SubmitButton pending={pending} variant="secondary">
        Change password
      </SubmitButton>
    </form>
  );
}
