# Provider and license notes

The required local stack uses PostgreSQL (PostgreSQL License), Prisma (Apache-2.0), Fastify (MIT), Next.js (MIT), React (MIT), Tailwind CSS (MIT), Lucide (ISC), and bcryptjs (MIT). Check the lockfile and upstream license files before distribution because transitive dependencies can change.

Ollama is MIT-licensed. The optional example model is `qwen2.5:1.5b`, whose published model card uses Apache-2.0. Model weights have separate licenses from Ollama; verify the exact tag before production use. The model is optional because this application uses deterministic backend tools for availability and booking.

Whisper/faster-whisper has strong English and Hindi coverage, but this repository does not claim validated Odia speech recognition. Piper does not provide a bundled, verified Odia voice here. Coqui projects and individual voice models have varying licenses. The UI therefore presents text fallback for every language and labels Odia speech unvalidated.

Google Calendar and Meta WhatsApp Cloud adapters require separate credentials and Internet access. Their commercial quotas and terms are external to this free local application. The current WhatsApp provider stores exact messages with `SIMULATED` status and offers a manual click-to-chat URL; it never reports delivery.
