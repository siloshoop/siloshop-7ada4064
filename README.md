# SiloShop

Arabic (RTL) multi-vendor marketplace — https://www.siloshop.net

## Tech stack

- React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui
- Supabase (database, auth, storage, edge functions)
- Capacitor (Android app), PWA

## Local development

Requirements: Node.js 18+ (or Bun).

```sh
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PROJECT_ID
npm run dev            # http://localhost:8080
```

## Scripts

- `npm run build` — production build into `dist/`
- `npm run preview` — serve the production build locally
- `npm run test` — unit tests (Vitest)

## Deployment

`dist/` is a static single-page app: deploy it to any static host
(Netlify, Vercel, Cloudflare Pages, Nginx…) with all unknown paths rewritten to `/index.html`.
Edge functions live in `supabase/functions` and deploy with the Supabase CLI
(`supabase functions deploy <name>`); their secrets are set with `supabase secrets set`.

See `docs/mobile-app.md` for the Android build.
