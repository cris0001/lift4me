# Conventions

The full engineering rules for Lift4Me: structure, naming, UI, testing, and how
design decisions are made. `CLAUDE.md` holds the short version; this file holds
the details and examples.

## Making decisions

Non-trivial architectural or design decisions are not made unilaterally.

### When to ask first

- Database schema (tables, columns, relationships, constraints)
- API endpoint design (URL structure, request/response shape, errors)
- State management (Zustand vs TanStack Query vs local state)
- Component architecture (compound vs props vs render prop)
- Folder or file structure not already documented here
- Libraries not already in the stack
- Trade-offs between approaches (performance vs simplicity, etc.)
- Naming for new concepts

### How to present options

Give 2–3 viable options with:

1. What each option means concretely
2. Pros and cons of each
3. A recommendation with reasoning
4. The default if there is no answer

Example:

```
For workout session storage, I see two approaches:

**Option A: Single table with nullable fields**
- workout_sessions has template_id (nullable), session_type enum
- Pros: simpler queries, one source of truth
- Cons: many nullable fields, harder to validate at DB level

**Option B: Separate tables for strength vs cardio**
- strength_sessions and cardio_sessions, joined by interface
- Pros: cleaner schema per type, easier validation
- Cons: more code, harder to query "all sessions"

My recommendation: A — most fitness apps grow into hybrid types
(circuit training, supersets), and a single table handles this
better. The nullable fields are well-defined by session_type.

Want me to go with A, or do you prefer B?
```

### Database schema proposals

Before writing any Drizzle code for new tables, propose the schema as plain
text:

1. Table name
2. Each column: name, type, nullable, default, why
3. Constraints (UNIQUE, FK, CHECK)
4. Relationships to other tables
5. Example row
6. Pseudo-queries for the main use cases (proves the schema works)

Review → approval → then Drizzle code.

### Migrations

- Generated with drizzle-kit, never run by the agent. The owner runs them.
- Always show the generated SQL first.
- Destructive operations (DROP, ALTER COLUMN that loses data) get an explicit
  warning and a backup recommendation.

### Explaining choices

For every non-trivial choice, say WHY in 1–3 sentences (in the code comment or
the summary): which alternative was rejected, what a non-obvious config does,
what the trade-off is. Skip it for trivial things (naming, basic syntax).

## Architecture

### Feature-based co-location

Every feature folder contains everything that feature needs. Shared code moves
to root-level folders only when 2+ features use it.

### Frontend feature (`apps/web/src/features/<name>/`)

Create only the subfolders that are needed:

- `api/` — API client functions
- `components/` — feature components
- `hooks/` — feature hooks
- `stores/` — Zustand stores
- `types/` — feature types (usually inferred from shared)
- `utils/` — pure functions
- `i18n.ts` — UI copy (English + Polish)
- `index.ts` — PUBLIC exports, the only thing imported from elsewhere

Minimum: `api/`, `components/`, `index.ts`.

```
apps/web/src/features/auth/
├── api/
│   ├── login.ts
│   ├── register.ts
│   └── me.ts
├── components/
│   ├── login-form.tsx
│   └── register-form.tsx
├── hooks/
│   └── use-current-user.ts
├── types/
│   └── index.ts
└── index.ts
```

### Shared frontend code (`apps/web/src/`)

- `app/` — routing root, providers, router config
- `routes/` — TanStack Router file routes
- `components/ui/` — shadcn primitives
- `components/` — domain-agnostic shared components (2+ features)
- `hooks/` — shared hooks (2+ features)
- `lib/` — infrastructure (api client, query client, i18n, utils)
- `stores/` — shared Zustand stores (theme, locale, palette)
- `utils/` — shared pure functions

### Frontend rules

- `index.ts` is the only public interface of a feature:
  - GOOD: `import { LoginForm } from '@/features/auth'`
  - BAD: `import { LoginForm } from '@/features/auth/components/login-form'`
- Components max ~150 lines — split if larger. One component per file.
- TanStack Query for ALL server data; no `fetch` in components.
- Zustand ONLY for local UI state (modals, drafts, filters), never a copy of
  server data.
- A custom hook for each piece of domain logic.
- Discriminated unions for loading states.

### Backend feature (`apps/api/src/features/<name>/`)

- `<name>.routes.ts` — Hono handlers: validate with Zod, delegate, format
- `<name>.service.ts` — ALL business logic, no Drizzle calls
- `<name>.repository.ts` — ONLY Drizzle queries, returns plain objects
- `<name>.utils.ts` — optional pure helpers
- `<name>.routes.test.ts` — route tests

Routes, service, and repository are required, as separate files.

```
apps/api/src/features/auth/
├── auth.routes.ts
├── auth.service.ts
└── auth.repository.ts
```

### Shared backend code (`apps/api/src/`)

- `db/schema/` — Drizzle schemas, one file per table group
- `db/migrations/` — generated by drizzle-kit
- `db/client.ts` — db client
- `middleware/` — shared Hono middleware (auth, error, cors)
- `lib/` — jwt, password, errors, env
- `index.ts` — app entry, assembles routes

### Backend rules

- Layers: routes → services → repositories.
- Routes stay thin — more than ~20 lines of logic moves to the service.
- Custom errors in `lib/errors.ts`, all extending `AppError`; a global handler
  turns them into responses.
- Response shape: `{ data: T }` on success, `{ error: { message, code } }` on
  error.
- Every query on user data filters by the signed-in user's id.

### Shared package (`packages/shared/src/`)

- `schemas/` — Zod schemas, one file per domain
- `types/` — types via `z.infer<typeof Schema>`, never hand-written
- `constants/` — enums and fixed values
- `utils/` — pure logic both apps need (macro math, moving averages)
- `index.ts` — public exports

The API validates request bodies with these schemas and the web app uses the
inferred types for forms and queries: one source of truth on both sides.

### Dependency rules

- No circular dependencies; one concern per file.
- Frontend features may import from: the shared package, `components/`,
  `hooks/`, `lib/`, `utils/`, `stores/`, and other features' `index.ts` only.
- Backend features may import from: shared, `db`, `lib`, `middleware`.

## Naming

- All file names kebab-case: `login-form.tsx`, `use-current-user.ts`,
  `format-date.ts`, `auth.service.ts`, `auth.schema.ts`,
  `workout-draft.store.ts`. Config files keep their fixed names.
- Components PascalCase, hooks `useX`, functions camelCase, classes PascalCase,
  types PascalCase, constants SCREAMING_SNAKE_CASE.
- Named exports only — no default exports.

## UI

### shadcn/ui

- Primitives live in `apps/web/src/components/ui/` (added with
  `pnpm dlx shadcn@latest add <name>`).
- Don't edit them unless customizing on purpose; then say why in a comment at the
  top of the file.
- Domain components compose primitives instead of rebuilding them.
- Styling only with Tailwind classes; theme via CSS variables.
- Dark mode: a Zustand theme store (persisted) toggles `class="dark"` on
  `<html>`. Charts read colors from CSS variables so they follow the theme.

### Mobile-first

The app is used mostly on a phone (at the gym, logging meals on the go).

- Base styles for mobile; scale up with `sm:`, `md:`, `lg:`, `xl:`.
- Touch targets at least 44×44 px.
- Critical actions within thumb reach (bottom 2/3 of the screen); one-handed
  use where possible.
- No hover-only UI; hover is progressive enhancement.
- Large inputs with the right keyboard (`inputMode="decimal"` for weight,
  email keyboard for email).
- Single column on mobile, more columns on larger screens.
- Sheets slide from the bottom on mobile (shadcn Sheet), sized to their content.
- Long lists paginated or virtualized.

### Active workout view

- Works one-handed; large weight/reps inputs; +/− buttons where they beat
  typing.
- Swapping an exercise takes minimal taps.
- Sets auto-save — no save button to forget.

### Copy

- Every UI string in English and Polish, in the feature's `i18n.ts` or
  `lib/i18n/messages.ts`. English is the source shape; every other locale must
  match it (the types enforce this). No new UI string without both languages.
- User content (exercise, food, recipe, workout, tag names, notes) is stored as
  typed; the app is language-agnostic about it.

### Verifying UI

Check in Chrome DevTools device emulation during development and on a real phone
before calling a feature done.

## Testing

Test by value and risk, not for coverage.

### Backend

- Route tests cover auth/ownership checks, conflict (4xx) responses, and
  critical happy paths.
- Mock the repository (the Drizzle boundary) so tests drive real Hono + service
  code over fake rows — no database in unit tests.
- Repository SQL is proved by live smoke tests, not unit tests.
- Test each distinct branch once where logic is shared; don't re-prove the same
  pattern on every resource.

### Frontend

- Test pure functions (macro math, moving averages, date helpers).
- Test critical flows as integration tests (form + hook + mocked API with MSW).
- Skip shadcn primitives, snapshots, trivial rendering, implementation details.

### Litmus test

If refactoring the internals breaks the test, it tests implementation (bad). If
the refactor works and the test still passes, it tests behavior (good).

## Commits

- Conventional Commits: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`,
  `perf`, `style`, `ci`, with a scope when useful
  (`feat(training): add exercise CRUD endpoints`).
- One logical chunk per commit (e.g. one schema, one service file), not a whole
  feature.

## Branches and pull requests

- `main` is protected: no direct pushes (admins included), no force-push, and
  the CI check "Lint, typecheck, test" must pass before merging.
- One branch per task, named by type: `feat/…`, `fix/…`, `docs/…`, `chore/…`,
  `style/…`, `refactor/…`.
- Each branch ends in a pull request with a short description (what, why, how
  to check). Merging to `main` deploys to production.
- After merging: delete the branch, then `git checkout main && git pull`.
