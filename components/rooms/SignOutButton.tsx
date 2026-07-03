"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace("/login");
      }}
      className="w-full rounded-full border border-line py-2.5 text-[14px] font-medium text-ink2"
    >
      Sign out
    </button>
  );
}
