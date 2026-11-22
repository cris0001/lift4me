# Lift4Me — Project Context

Lift4Me (https://lift4.me) is a mobile-first fitness tracker: strength training,
nutrition (macros only), and body measurements in one web app. Open registration,
every row owned by a user; access gated by an optional licence expiry (payments not
wired yet). Not multi-tenant SaaS — no organisations, roles, or teams.

Workspace packages keep their original `@gym-bro/*` names; the project was
renamed later and renaming them isn't worth the churn.

## Read when relevant

- `docs/DOMAIN.md` — business rules (training, nutrition, body, accounts).
  **Read before changing domain logic.**
- `docs/CONVENTIONS.md` — full architecture, naming, UI, testing rules, and the
  format for proposing decisions and DB schemas.
- `docs/DECISIONS.md` — why the stack is what it is (ADRs).
- `docs/FRONTEND_ARCHITECTURE.md` — frontend data layer and routing in depth.
- `docs/DEPLOYMENT.md` — AWS production setup, CI/CD, migrations.

## Commands

```bash
pnpm dev                                   # web :5173 + API :3001
pnpm lint | pnpm typecheck | pnpm test     # all packages
pnpm --filter @gym-bro/web test            # one package
pnpm --filter @gym-bro/api db:generate     # generate a migration (never run it)
pnpm format                                # prettier --write .
```

## Stack

- pnpm monorepo: `apps/web`, `apps/api`, `packages/shared`. Shared ESLint +
  Prettier config; Husky + lint-staged on commit; Conventional Commits.
- Web: React 19, Vite (SPA, not Next.js), TypeScript strict, TanStack Query v5
  (server state), Zustand v5 (UI state only), TanStack Router v1, Tailwind v4,
  shadcn/ui, React Hook Form + Zod, Recharts, dnd-kit, date-fns, Vitest +
  Testing Library + MSW.
- API: Hono (not Express) on Node 22, Drizzle (not Prisma), PostgreSQL on Neon,
  Zod (request bodies + env validated at boot in `lib/env.ts`), jose (JWT in
  HttpOnly cookie), bcryptjs (pure JS, no native build in the image).
- Shared: Zod schemas as the single source of truth, types via `z.infer`.
- Infra: Docker on AWS EC2 behind nginx + Cloudflare, Terraform, GitHub Actions.

## How to work

- **Small steps — non-negotiable.** One file (or one small focused change) per
  step, then stop, summarize, and ask ("continue with X, or review this
  first?"). Never chain several file creations in one go. Trivial edits
  (typos, one-liners) may be batched 2–3 at a time.
- **Plan before bigger tasks.** For anything touching several files or a new
  feature, propose a plan and wait for approval before writing code.
- **Ask before architecture decisions** — schema, endpoints, state placement,
  component architecture, new folders, new libraries, naming of new concepts.
  Give 2–3 options, pros/cons, a recommendation, and the default
  (format in `docs/CONVENTIONS.md`). DB schema: propose as plain text first.
- **Explain non-obvious choices** in 1–3 sentences.
- **Stay in scope.** No unrelated changes.
- **Commits:** never commit or push. When a logical chunk is done, show what
  changed (`git status` / `git diff`) and give a ready command with a
  Conventional Commit message (`feat(scope): …`); the user runs it. No AI
  attribution, `Co-Authored-By`, or footers in commit messages.
- **Migrations:** only generate them; never run migrate/push. Show the SQL;
  warn loudly on DROP or data-losing ALTER.
- Edited TS files are linted automatically and the workspace is typechecked
  before you finish (hooks in `.claude/`). Before suggesting a commit for a
  non-trivial change, run the `reviewer` agent.

## Hard rules

**Code**

- No `any`. Named exports only. Kebab-case file names. One component per file.
- No Axios (native fetch), Express, Prisma, Next.js. No DI containers or
  decorators.
- No generic comments that restate the code.

**Frontend**

- Import another feature only via its `index.ts` (`@/features/x`), never its
  internals.
- All server data through TanStack Query hooks; no `fetch` in components.
  Zustand never mirrors server data.
- Components max ~150 lines.
- Every UI string in English and Polish (feature `i18n.ts` or
  `lib/i18n/messages.ts`).
- Mobile-first: base classes for the phone, scale up with breakpoints. Touch
  targets ≥ 44×44 px. No hover-only UI. Numeric `inputMode` for numbers.

**Backend**

- Routes (validate with shared Zod, delegate) → services (all logic, no
  Drizzle) → repositories (only Drizzle).
- Every query on user data filters by the signed-in user.
- Errors extend `AppError`; responses are `{ data }` or
  `{ error: { message, code } }`.
- Route tests for auth/ownership and conflict cases; mock the repository.

**Data**

- Types come from Zod schemas in `packages/shared`, never hand-written.
- No seed data or predefined exercises/foods/tags for normal users (the demo
  account is seeded by `apps/api/src/db/seed-demo.ts`).
- No OAuth login (Strava OAuth is a data integration only).

## Language

Code, comments, commits: English. UI: English + Polish. User content (names,
notes) is stored as typed.
