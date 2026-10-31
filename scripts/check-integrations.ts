import { googleCalendarStatus } from "../apps/api/src/google-calendar.js";

async function main() {
  const googleCalendar = await googleCalendarStatus();
  const state = googleCalendar.connected
    ? "connected"
    : googleCalendar.configured
      ? `not connected — ${googleCalendar.detail}`
      : "not configured";

  console.log(`Google Calendar integration: ${state}`);
}

void main();
