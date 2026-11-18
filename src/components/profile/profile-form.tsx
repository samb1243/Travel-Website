"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, SubmitButton } from "@/components/auth/form-bits";
import { UserAvatar } from "@/components/user-avatar";
import { ImagePicker } from "@/components/image-picker";
import { CURRENCIES } from "@/lib/currencies";
import { setProfilePhoto, updateProfile, type ProfileState } from "@/server/actions/profile";
import { useRouter } from "next/navigation";

export function ProfileForm({
  user,
}: {
  user: { name: string; email: string; image: string | null; homeCurrency: string };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, { ok: false });
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState(user.image ?? "");
  const [currency, setCurrency] = useState(user.homeCurrency);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);

  /** The photo saves on its own, so the header avatar updates at once */
  function changePhoto(url: string) {
    const previous = image;
    setImage(url);
    startTransition(async () => {
      const result = await setProfilePhoto(url);
      if (result.ok) {
        toast.success(url ? "Profile photo updated" : "Profile photo removed");
        router.refresh();
      } else {
        setImage(previous);
        toast.error(result.message ?? "Couldn't save your photo. Try again.");
      }
    });
  }

  // Submit via a handler rather than <form action>: React resets the form after
  // a form action, and that reset snaps the Radix currency picker back to its
  // first value. Fields here are controlled, so no reset is wanted anyway.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center gap-4">
        <UserAvatar name={name || user.name} image={image.startsWith("https://") || image.startsWith("/img/") ? image : null} className="size-16 text-lg" />
        <div className="min-w-0">
          <div className="truncate font-medium">{name || user.name}</div>
          <div className="truncate text-sm text-muted-foreground">{user.email}</div>
        </div>
      </div>

      <Field
        id="name"
        name="name"
        label="Name"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={state.errors?.name}
      />
      <ImagePicker
        name="image"
        value={image}
        onChange={changePhoto}
        label="Profile photo (optional)"
        purpose="avatar"
        preview={false}
        error={state.errors?.image}
      />
      <p className="-mt-3 text-sm text-muted-foreground">
        Upload one from your device or paste a link. It&apos;s saved straight away, and shows in the top corner and
        next to trips you share.
      </p>
      <div className="space-y-2">
        <Label htmlFor="homeCurrency">Home currency</Label>
        <Select name="homeCurrency" value={currency} onValueChange={setCurrency}>
          <SelectTrigger id="homeCurrency" className="w-full text-base data-[size=default]:h-12 md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} · {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {state.errors?.homeCurrency ?? "Used as the default currency for new trips."}
        </p>
      </div>

      <SubmitButton pending={pending}>Save profile</SubmitButton>
    </form>
  );
}
