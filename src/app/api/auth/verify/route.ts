import { apiError } from "@/lib/http";

export async function POST() {
  return apiError("Wallet login moved to Clerk. Use /sign-in.", 410);
}
