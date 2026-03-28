import { createBrowserClient } from "@supabase/ssr";

// Browser-safe Supabase client — uses only public keys.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
