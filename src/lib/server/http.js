// Named so the timeout differences between outbound API calls read as
// intentional rather than as unlabeled magic numbers repeated at each call
// site (previously 5000/8000/10000ms scattered across turnstile.js, zoom.js,
// google-calendar.js, and office/actions.js).
export const HTTP_TIMEOUT_MS = {
  fast: 5000, // bot verification — must not block form submission for long
  default: 8000, // most outbound provider calls (Zoom, Google Calendar)
  slow: 10000, // larger/less latency-sensitive sends (proposal email)
};
