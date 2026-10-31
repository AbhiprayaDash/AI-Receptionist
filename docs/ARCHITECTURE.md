# Architecture

Namaste Desk is a small npm workspace with a Next.js dashboard, a Fastify API, and PostgreSQL accessed through Prisma. The local calendar is the source of truth. Optional AI, speech, Google Calendar, WhatsApp Cloud, and telephony providers sit behind adapters and cannot silently turn a failed production call into mock success.

The booking state machine collects a language, name, phone, service, date, and time. It requests availability from the scheduling engine. Booking uses a serializable transaction and a PostgreSQL advisory lock for the selected staff member, then checks overlaps again before writing. The LLM never writes to the database.

Every protected query derives `tenantId` from the signed session token. Business-owned records use `businessId`, and appointments also carry an indexed `tenantId`. Public conversation routes are intentionally scoped to the business selected by the demo, while management records require authentication.

The default timezone is `Asia/Kolkata`. Local dates are converted with the `+05:30` offset and rendered with explicit timezone options.

## Provider boundaries

- `LLMProvider`: optional Ollama adapter; deterministic booking continues without it.
- `SpeechToTextProvider` and `TextToSpeechProvider`: interfaces and explicit capability reporting. No language is marked ready without a tested model.
- `MessagingProvider`: mock output is persisted as `SIMULATED`; manual `wa.me` links are user-triggered.
- `TelephonyProvider`: browser simulator reports `pstn: false`.
- Local calendar: required and free. Google Calendar is an optional future OAuth adapter.

## Resource profile

The web/API/database path needs roughly 1–2 GB RAM. The optional `qwen2.5:1.5b` model needs about 1.5 GB storage and around 3–5 GB free RAM for CPU inference. Response speed depends heavily on CPU. Low-resource mode is the default deterministic text path.
