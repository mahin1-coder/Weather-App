# Weather Now (Month-1 Foundation)

Next.js + TypeScript weather app with a server-side API proxy, hourly cache revalidation, stronger error handling, and accessibility baseline improvements.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open `http://localhost:3000`

## Environment variables

Copy `.env.example` to `.env.local` and adjust values as needed.

## What is included

- Next.js App Router + strict TypeScript
- Server route handler at `/api/weather?q=<city>`
- Timeout-safe fetch utility with explicit HTTP error checks
- Local-date parsing for `YYYY-MM-DD` to avoid UTC day-shift bugs
- Accessible status updates using `role="status"` and visible `:focus-visible`
- CI workflows for typecheck, lint, build, and Lighthouse CI

## Deployment

Deploy on a Next.js-capable host (for example, Vercel). Ensure API provider commercial terms are valid before monetization.
