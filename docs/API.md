# REST API

The API listens on `http://localhost:4000`. Protected routes use `Authorization: Bearer <token>`.

- `GET /health` — database readiness.
- `POST /auth/register`, `POST /auth/login` — account and tenant sessions.
- `GET /demo` — fictional clinic metadata.
- `POST /conversations` — start an `EN`, `HI`, or `OR` text session.
- `POST /conversations/:id/messages` — advance deterministic booking and return confirmation data.
- `GET /dashboard`, `/appointments`, `/customers`, `/notifications` — tenant-scoped dashboard data.
- `POST /appointments/:id/cancel` — cancel a confirmed appointment.
- `POST /appointments/:id/reschedule` — revalidate and move a booking.
- `PATCH /business` — update tenant business profile.
- `GET /integrations/status` — honest local provider capabilities.
- `POST /telephony/twilio/incoming` — signed Twilio inbound-call webhook returning TwiML.
- `POST /telephony/twilio/language` — signed Twilio language-selection webhook.
- `POST /telephony/twilio/respond` — signed Twilio booking-turn webhook.
- `POST /telephony/twilio/calls` — authenticated outbound-call request using an E.164 `to` number.

Errors use `{ "error": "message" }`. Dates supplied for rescheduling are ISO 8601 strings. Conversation date input uses `YYYY-MM-DD`; offered times come from the database and are displayed in Asia/Kolkata.
