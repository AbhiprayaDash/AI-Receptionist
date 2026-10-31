# Namaste Desk

A free, local-first multilingual receptionist and appointment booking SaaS for fictional Indian small-business demos. It supports working English, Hindi, and Odia text booking, a tenant-aware local calendar, a responsive dashboard, and simulated WhatsApp confirmations. No credit card or paid API key is required.

## Start locally

Requirements: Node.js 22+, npm 10+, and Docker with Compose.

```bash
cp .env.example .env
npm ci
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The fictional demo signs in locally as `owner@abc-clinic.local` with password `demo1234`. Change all sample credentials outside a private local demo.

The dashboard calls the API at `http://localhost:4000`. Verify it with `curl http://localhost:4000/health`.

## Test a booking

Open **AI Receptionist**, choose English, हिंदी, or ଓଡ଼ିଆ, and answer the prompts. Dates use `YYYY-MM-DD`; choose one of the times returned from PostgreSQL. The result appears in **Calendar** and **Notifications**. The WhatsApp record says `SIMULATED` and the click-to-chat link requires a person to send it.

Run `npm test`, `npm run typecheck`, and `npm run build` for automated validation. See [testing](docs/TESTING.md), [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), and [providers](docs/PROVIDERS.md).

For a public deployment, see [Vercel and Neon deployment](docs/DEPLOYMENT.md).

## Optional local AI

The booking flow works without an LLM. To inspect local Ollama status:

```bash
docker compose --profile ai up -d ollama
docker compose exec ollama ollama pull qwen2.5:1.5b
```

The small Qwen model is suitable for CPU experiments, but multilingual quality varies and Odia should be evaluated with representative business conversations. The browser receptionist supports microphone input and spoken replies where the browser provides Web Speech APIs; text remains the fallback and Odia speech is not claimed as validated.

## Offline and production boundaries

After initial dependency, image, and optional model downloads, the core database, API, dashboard, scheduling, text conversations, and simulated messages work offline. Google Calendar, manual `wa.me` navigation, WhatsApp Cloud delivery, and real telephony require Internet or third-party services. Production messaging and telephone numbers can incur costs and are disabled by default.
