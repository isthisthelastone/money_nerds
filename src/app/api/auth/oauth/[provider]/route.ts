import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return apiError("Google and Apple login moved to Clerk. Use /sign-in.", 410);
}
