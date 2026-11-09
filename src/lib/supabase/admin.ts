import { createClient } from "@supabase/supabase-js";
export function adminDb() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("Server configuration is incomplete.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
