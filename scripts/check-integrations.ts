import { googleCalendarStatus } from "../apps/api/src/google-calendar.js";
import { twilioStatus } from "../apps/api/src/twilio.js";

async function main() {
  const googleCalendar = await googleCalendarStatus();
  const state = googleCalendar.connected
    ? "connected"
    : googleCalendar.configured
      ? `not connected — ${googleCalendar.detail}`
      : "not configured";

  console.log(`Google Calendar integration: ${state}`);

  const telephone = await twilioStatus();
  const telephoneState = telephone.connected
    ? "connected"
    : telephone.configured
      ? `not connected — ${telephone.detail}`
      : "not configured";
  console.log(`Twilio telephone integration: ${telephoneState}`);
}

void main();
