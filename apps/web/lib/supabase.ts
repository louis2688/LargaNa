import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@largana/core";

// Browser client only; server-side auth (admin console) comes with Phase 2.
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
