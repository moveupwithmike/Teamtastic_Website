import { PostHog } from "posthog-node";

let client = null;

function getClient() {
  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
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
  posthog.capture({ distinctId: String(distinctId), event, properties });
  await posthog.flush();
}
