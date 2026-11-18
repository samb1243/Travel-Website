"use client";

import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { clearOffline } from "@/lib/offline";

export function useSignOut() {
  const router = useRouter();
  return async () => {
    // Trips saved for offline use belong to this account: delete them from the device
    await clearOffline();
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
