/* Service-role client. Server contexts only: seed scripts, cron jobs, pipeline.
   Importing this from client code is a build error by design ("server-only"). */

import "server-only";
import { createClient } from "@supabase/supabase-js";

export function supabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Service client requires SUPABASE env to be configured.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
