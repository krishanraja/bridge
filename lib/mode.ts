/* Demo mode: seed-file data source and auth bypass for local audits and previews.
   Never active on a production deploy; production always runs auth against Supabase. */

export function isDemoMode(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.DEMO_MODE === "true";
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/* Data comes from seed files when in demo mode or when the database is not yet configured. */
export function useSeedData(): boolean {
  return isDemoMode() || !hasSupabaseEnv();
}
