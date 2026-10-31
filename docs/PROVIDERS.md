# Provider and license notes

The required local stack uses PostgreSQL (PostgreSQL License), Prisma (Apache-2.0), Fastify (MIT), Next.js (MIT), React (MIT), Tailwind CSS (MIT), Lucide (ISC), and bcryptjs (MIT). Check the lockfile and upstream license files before distribution because transitive dependencies can change.

Ollama is MIT-licensed. The optional example model is `qwen2.5:1.5b`, whose published model card uses Apache-2.0. Model weights have separate licenses from Ollama; verify the exact tag before production use. The model is optional because this application uses deterministic backend tools for availability and booking.

The receptionist can use the browser Web Speech APIs for microphone input and spoken responses. Browser and operating-system language support varies, microphone permission is required, and Odia speech quality is not claimed as validated. Text remains available throughout the conversation. This browser feature does not make or receive telephone-network calls.

Google Calendar sync uses a service account and a calendar explicitly shared with that account. It creates, updates, and removes events while PostgreSQL remains the booking source of truth. Google Calendar and Meta WhatsApp Cloud adapters require separate credentials and Internet access. Their commercial quotas and terms are external to this free local application. The current WhatsApp provider stores exact messages with `SIMULATED` status and offers a manual click-to-chat URL; it never reports delivery.

Real inbound and outbound telephone calls use the optional Twilio adapter. It provides signed inbound webhooks, English/Hindi/Odia language selection, speech capture for the caller's name, keypad capture for booking details, and authenticated outbound call creation. Odia text-to-speech quality depends on Twilio's available voices and is not claimed as validated. A Twilio voice number, credentials, usage charges, and any local regulatory requirements remain the account owner's responsibility.
