## Goal
Bring the codebase to "clean, quiet, and fast" without changing UI or business logic. Every change must be justified by a signal (tool report, error, or measurement), and every step ends with a verification.

## Guardrails (non-negotiable)
- No UI redesign, no feature removal, no business-logic changes.
- Do not touch: `src/integrations/supabase/{client,types}.ts`, `.env`, `supabase/config.toml`.
- Preserve all existing routes, RPC calls, RLS, and Realtime subscriptions.
- Each phase must end green (build passes, security tests pass) before the next starts. If a phase turns red and can't be fixed in one edit, revert that phase's changes.

## Phase 1 — Baseline & inventory
1. Capture current signals: `tsgo` typecheck, `eslint`, `vitest run`, `vite build --mode production` (bundle size + warnings), console log snapshot from preview.
2. Run `knip` (unused files/exports/deps) and `depcheck` (missing/unused packages) as one-off `bunx` invocations — no config commit yet.
3. Save the reports under `/tmp/audit/` and produce a short "to-remove" list. Nothing is deleted in this phase.

## Phase 2 — Safe sweep (low risk)
- Remove unused imports, unreachable code, commented-out blocks, `console.log` debug lines (keep `console.error`/`warn`).
- Delete files that `knip` marks unused AND are not referenced by routing, Vite globs, or dynamic imports (manually re-checked with `rg`).
- Delete unused exports inside kept files.
- Verify: typecheck + build + vitest + security-rls tests.

## Phase 3 — Dependency audit
- For every package `depcheck` flags: confirm with `rg` it's truly unreferenced, then `bun remove`.
- Do not upgrade major versions. Only patch/minor bumps for packages with known CVEs (from `bun audit`), and only if changelogs show no breaking changes.
- Verify: full build + tests after each batch of removals.

## Phase 4 — Rendering & bundle optimisation
- Add `React.lazy` + `Suspense` for heavy, non-critical routes only (Admin, Vendor dashboard sub-pages, Blog article, Pricing, FAQ). Do not lazy-load homepage-critical sections — that's forbidden by our error-isolation memory.
- Wrap expensive list items in `React.memo` only where profiler-style reasoning shows repeated re-renders (cards that receive stable props). No blanket memoisation.
- Replace any remaining `import * as` with named imports where tree-shaking is blocked.
- Verify: production build. Report before/after `dist/assets` sizes.

## Phase 5 — Lint & TypeScript strictness
- Fix every existing ESLint warning/error surfaced in Phase 1 (unused vars, exhaustive-deps, no-explicit-any where a real type is obvious). Do not tighten `tsconfig` — out of scope.
- Fix runtime warnings visible in the console snapshot (React key warnings, controlled/uncontrolled input, act warnings in tests, etc.).
- Verify: `eslint .` returns 0 warnings/errors, `tsgo` returns 0 errors.

## Phase 6 — Structural tidy
- Only rename/move a file if it currently lives in the wrong folder per existing conventions (e.g. a hook under `src/components/`). No mass reorganisation.
- Split any component file over ~400 lines into logical sub-components in a sibling folder, keeping the public export identical so imports don't change.

## Phase 7 — Final validation
- `bun install`, `tsgo`, `eslint .`, `bunx vitest run`, production `vite build`.
- Re-run `security--run_security_scan` and confirm no new findings.
- Post a short before/after diff: bundle size, warning count, files/deps removed.

## Rollback strategy
Each phase is a self-contained set of edits. If verification fails and I can't fix it in a single follow-up patch, I revert that phase's edits and stop — you'll get a report of what was tried, not a broken tree.

## Out of scope (call these out so you can add them if wanted)
- Major-version upgrades (React 19, Vite 6, Tailwind 4).
- Switching bundler/test runner.
- Adding new tests beyond what's needed to protect a refactor.
- Any design/UX change.
- Server-side/edge function refactors.

## Technical details
- Tools used ad-hoc: `bunx knip`, `bunx depcheck`, `bun audit`, `tsgo`, `bunx eslint .`, `bunx vitest run`, `bun run build`.
- No config files added unless required (e.g. a minimal `knip.json` if false-positives dominate).
- Playwright smoke-check on the top 5 routes (`/`, `/search`, `/orders`, `/favorites`, `/pricing`) after Phase 4 and Phase 7.

Approve to proceed with Phase 1, or tell me which phases to skip.