import { createClient } from "@supabase/supabase-js";
/* eslint-disable */

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  throw new Error(
    `Missing Supabase environment variables. 
    URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || "undefined"}, 
    Key: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "undefined"}`,
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 export const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

const token = typeof window !== 'undefined'
    ? localStorage.getItem("sb_access_token")
    : null;

export const supabase = createClient(supabaseUrl, supabaseAnonKey,  {
  global: {
    headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
  },
});
