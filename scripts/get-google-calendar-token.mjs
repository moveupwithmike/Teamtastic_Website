// One-time helper: exchanges a Google OAuth consent for a Calendar refresh
// token without the manual OAuth Playground copy-paste flow. Run locally,
// approve the browser prompt once, and this appends the refresh token to
// .env.local automatically.
import { createServer } from "node:http";
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { exec } from "node:child_process";

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth/callback`;
const SCOPE = "https://www.googleapis.com/auth/calendar";

function loadEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) throw new Error(".env.local not found. Create it first.");
  const text = readFileSync(path, "utf8");
  const values = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

const env = loadEnvLocal();
const clientId = env.GOOGLE_CALENDAR_CLIENT_ID;
const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET to .env.local first, then rerun this script.");
  process.exit(1);
}

console.log(`\nBefore continuing: in Google Cloud Console, open your "Teamtastic Booking Calendar" OAuth client`);
console.log(`and add this exact Authorized redirect URI, then save:\n\n  ${REDIRECT_URI}\n`);
console.log("Press Enter once you've added it and saved...");
await new Promise((resolve) => process.stdin.once("data", resolve));

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end(`Authorization failed: ${error}. Close this tab and check the terminal.`);
    console.error(`\nGoogle returned an error: ${error}`);
    server.close();
    process.exit(1);
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: REDIRECT_URI, grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData.refresh_token) {
    res.writeHead(500, { "Content-Type": "text/plain" }).end("Token exchange failed. Check the terminal for details.");
    console.error("\nToken exchange failed:", JSON.stringify(tokenData, null, 2));
    if (tokenData.error === "invalid_grant") {
      console.error("\nIf you've authorized this app before, Google may be reusing a stale consent. Try revoking access at https://myaccount.google.com/permissions and running this script again.");
    }
    server.close();
    process.exit(1);
  }

  const envPath = new URL("../.env.local", import.meta.url);
  appendFileSync(envPath, `\nGOOGLE_CALENDAR_REFRESH_TOKEN=${tokenData.refresh_token}\n`);

  res.writeHead(200, { "Content-Type": "text/plain" }).end("Success! You can close this tab and return to the terminal.");
  console.log("\nDone. GOOGLE_CALENDAR_REFRESH_TOKEN was appended to .env.local.");
  console.log("Copy the same three values (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) into Vercel's Environment Variables when ready.");
  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`\nOpening your browser to sign in and approve calendar access...`);
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${opener} "${authUrl.toString()}"`);
});
