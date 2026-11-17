import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { APP_NAME } from "@/lib/brand";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 rounded-md font-heading text-xl font-semibold tracking-tight"
      aria-label={`${APP_NAME} home`}
    >
      <LogoMark />
      {APP_NAME}
    </Link>
  );
}
