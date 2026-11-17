"use client";

import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function useSignOut() {
  const router = useRouter();
  return async () => {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  };
}

export function SignOutButton(props: ComponentProps<typeof Button>) {
  const signOut = useSignOut();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
      }}
      {...props}
    >
      <LogOutIcon aria-hidden /> Log out
    </Button>
  );
}
