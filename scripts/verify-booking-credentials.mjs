// Confirms the Google Calendar and Zoom credentials in .env.local are valid
// by requesting access tokens only — no meeting or calendar event is created.
import { readFileSync, existsSync } from "node:fs";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) throw new Error(".env.local not found.");
  const text = readFileSync(path, "utf8");
  const values = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

const env = loadEnvLocal();

async function checkGoogleCalendar() {
  const { GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN } = env;
  if (!GOOGLE_CALENDAR_CLIENT_ID || !GOOGLE_CALENDAR_CLIENT_SECRET || !GOOGLE_CALENDAR_REFRESH_TOKEN) {
    console.log("Google Calendar: MISSING credentials in .env.local");
    return;
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: GOOGLE_CALENDAR_CLIENT_SECRET,
      refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (response.ok && data.access_token) {
    console.log(`Google Calendar: OK (token expires in ${data.expires_in}s, scope: ${data.scope || "unspecified"})`);
  } else {
    console.log(`Google Calendar: FAILED — ${data.error || response.status}: ${data.error_description || ""}`);
  }
}

async function checkZoom() {
  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_HOST_EMAIL } = env;
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    console.log("Zoom: MISSING credentials in .env.local");
    return;
  }
  const response = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64")}` },
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.log(`Zoom: FAILED to get access token — ${data.reason || response.status}`);
    return;
  }
  console.log(`Zoom: token OK (scopes: ${data.scope ? data.scope.split(" ").length : 0} granted)`);

  if (!ZOOM_HOST_EMAIL) {
    console.log(`Zoom host user: SKIPPED (ZOOM_HOST_EMAIL not set)`);
    return;
  }
  const userResponse = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(ZOOM_HOST_EMAIL)}`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (userResponse.ok) {
    console.log(`Zoom host user (${ZOOM_HOST_EMAIL}): FOUND on this account`);
  } else {
    const err = await userResponse.json().catch(() => ({}));
    console.log(`Zoom host user (${ZOOM_HOST_EMAIL}): NOT FOUND — ${err.message || userResponse.status}. This email must match a user on this Zoom account.`);
  }
}

await checkGoogleCalendar();
await checkZoom();
