import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

// Same origin as the app, so no baseURL needed.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
