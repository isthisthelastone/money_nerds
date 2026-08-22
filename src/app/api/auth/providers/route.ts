import { NextResponse } from "next/server";
import { EXTERNAL_AUTH_PROVIDERS } from "@/lib/auth/external-core";
import { getExternalProviderAvailability } from "@/lib/auth/external";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = NextResponse.json({
    providers: Object.fromEntries(
      EXTERNAL_AUTH_PROVIDERS.map((provider) => {
        const availability = getExternalProviderAvailability(provider);
        return [
          provider,
          {
            provider,
            available: availability.available,
            startUrl: availability.startUrl,
            ...(availability.available && availability.botUsername
              ? { botUsername: availability.botUsername }
              : {}),
            ...(availability.available && availability.requiresSupabaseDashboard
              ? { requiresSupabaseDashboard: true }
              : {}),
          },
        ];
      }),
    ),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
