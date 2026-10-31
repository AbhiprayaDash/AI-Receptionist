# Vercel and Neon deployment

The production deployment uses one Vercel project and one Neon PostgreSQL database. Vercel serves the Next.js dashboard and exposes the Fastify application through `/api`. Neon supplies `DATABASE_URL` with TLS enabled.

Required Vercel environment variables:

- `DATABASE_URL`: Neon pooled PostgreSQL connection string, including `sslmode=require`.
- `JWT_SECRET`: a long, randomly generated production value.
- `NEXT_PUBLIC_API_URL`: `/api`.
- `OLLAMA_URL` and `OLLAMA_MODEL` are optional. A local Ollama container is not reachable from Vercel.

The `vercel-build` script generates Prisma, applies checked-in migrations, idempotently seeds the fictional demo, and builds the web application. The production seed account is only for demonstration and should be removed or have its password changed before accepting real customer data.

Deployment from the repository root:

```bash
npx vercel link
npx vercel env add DATABASE_URL production
npx vercel env add JWT_SECRET production
npx vercel env add NEXT_PUBLIC_API_URL production
npx vercel deploy --prod
```

Use Vercel's secure prompts for values. Never commit `.env`, Neon credentials, or Vercel tokens.
