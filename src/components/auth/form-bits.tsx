"use client";

import { useState, type ComponentProps } from "react";
import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + input + inline error, sized for thumbs. */
export function Field({
  label,
  error,
  hint,
  id,
  className,
  ...input
}: ComponentProps<typeof Input> & { label: string; error?: string; hint?: string; id: string }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("h-12 text-base md:text-sm", className)}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField(props: Omit<ComponentProps<typeof Field>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Field {...props} type={visible ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-[30px] right-1 grid size-10 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
      </button>
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  ...props
}: ComponentProps<typeof Button> & { pending: boolean }) {
  return (
    <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending} {...props}>
      {pending ? <LoaderCircleIcon className="size-5 animate-spin" aria-hidden /> : null}
      {children}
    </Button>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      {message}
    </p>
  );
}

export function FormSuccess({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
      {message}
    </p>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      or
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Turns Better Auth error codes into plain English. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null) {
  if (!error) return null;
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match. Check for typos, or reset your password.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "There's already an account with this email. Try logging in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters.";
    case "INVALID_PASSWORD":
      return "Your current password is wrong.";
    case "INVALID_TOKEN":
      return "This reset link has expired or was already used. Request a new one.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "This account signs in with Google, so it has no password to change.";
  }
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  return error.message || "Something went wrong. Please try again.";
}
