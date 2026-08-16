import { HTTP_TIMEOUT_MS } from "@/lib/server/http";

function requireZoomCredentials() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  if (!accountId || !clientId || !clientSecret) throw new Error("zoom_credentials_missing");
  return { accountId, clientId, clientSecret };
}

async function getZoomAccessToken() {
  const { accountId, clientId, clientSecret } = requireZoomCredentials();
  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS.default),
  });
  if (!response.ok) throw new Error(`zoom_token_${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error("zoom_token_missing");
  return data.access_token;
}

export async function createZoomMeeting({ topic, startsAt, durationMinutes, timezone, hostEmail }) {
  const accessToken = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(hostEmail)}/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: topic.slice(0, 200),
      type: 2,
      start_time: startsAt,
      duration: durationMinutes,
      timezone,
      settings: {
        join_before_host: false,
        waiting_room: true,
        approval_type: 2,
        mute_upon_entry: true,
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS.default),
  });
  if (!response.ok) throw new Error(`zoom_meeting_${response.status}`);
  const data = await response.json();
  if (!data.id || !data.join_url) throw new Error("zoom_meeting_incomplete");
  return { meetingId: String(data.id), joinUrl: data.join_url };
}

export async function cancelZoomMeeting(meetingId) {
  const accessToken = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS.default),
  });
  if (!response.ok && response.status !== 404) throw new Error(`zoom_cancel_${response.status}`);
}
