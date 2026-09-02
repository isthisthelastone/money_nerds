import { apiError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return apiError("This legacy OAuth callback has been retired.", 410);
}
