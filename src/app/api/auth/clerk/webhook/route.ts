import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { type NextRequest } from "next/server";
import { syncExistingClerkProfileFromWebhook } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

function displayName(firstName: string | null | undefined, lastName: string | null | undefined) {
  const value = [firstName, lastName].filter(Boolean).join(" ").trim();
  return value ? value.slice(0, 80) : null;
}

export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    await syncExistingClerkProfileFromWebhook({
      id: event.data.id,
      createdAt: event.data.created_at,
      updatedAt: event.data.updated_at,
      displayName: displayName(event.data.first_name, event.data.last_name),
      avatarUrl: event.data.image_url,
      deleted: false,
    });
  } else if (event.type === "user.deleted" && event.data.id) {
    await syncExistingClerkProfileFromWebhook({
      id: event.data.id,
      createdAt: null,
      updatedAt: Date.now(),
      displayName: null,
      avatarUrl: null,
      deleted: true,
    });
  }

  return new Response("OK", {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
