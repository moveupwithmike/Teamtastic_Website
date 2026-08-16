import { PostHog } from "posthog-node";

let client = null;

function getClient() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function captureServerEvent(event, distinctId, properties = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const posthog = getClient();
  if (!posthog) return;
  posthog.capture({ distinctId: String(distinctId), event, properties });
  await posthog.flush();
}
