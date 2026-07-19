function requireCalendarCredentials() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("calendar_credentials_missing");
  return { clientId, clientSecret, refreshToken };
}

export async function getGoogleCalendarAccessToken() {
  const { clientId, clientSecret, refreshToken } = requireCalendarCredentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`calendar_token_${response.status}`);
  const data = await response.json();
  if (!data.access_token) throw new Error("calendar_token_missing");
  return data.access_token;
}

export async function getCalendarBusyRanges({ calendarId, timeMin, timeMax, timeZone }) {
  const accessToken = await getGoogleCalendarAccessToken();
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, timeZone, items: [{ id: calendarId }] }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`calendar_freebusy_${response.status}`);
  const data = await response.json();
  const calendar = data.calendars?.[calendarId];
  if (calendar?.errors?.length) throw new Error(`calendar_freebusy_${calendar.errors[0]?.reason || "error"}`);
  return (calendar?.busy || []).map((range) => ({
    start: new Date(range.start),
    end: new Date(range.end),
  }));
}
