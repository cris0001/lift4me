# Lift4Me

A mobile-first fitness tracker that keeps strength training, nutrition, and body
measurements in one app.

**Live:** <https://lift4.me>

**Demo account:** `demo@gymbro.app` / `demo1234` (about two months of training,
nutrition, and body history). Shared by every visitor, so please don't change the
password.

## Features

- **Training:** your own exercises, plans, and workout templates; a calendar with
  drag-to-reschedule; a one-handed active-workout view (auto-saved sets, copy last
  set, swap exercise, notes); history with full edit; rating and tags.
- **Stats:** per-exercise progress (max weight, volume) and a workout-rating trend.
- **Nutrition:** a food dictionary with per-100 g macros, recipes, a daily diary split
  into meals, historical calorie and macro targets, barcode scanning through
  Open Food Facts, and a photo-to-macros estimate.
- **Body:** weight, body fat, and circumferences, with 7- and 30-day moving
  averages.
- **Dashboard:** today's calories against the target, the next planned session,
  the weight trend, and the last workout.
- **Strava:** connect your account and import activities.
- English and Polish UI, dark mode, installable as a PWA.

## Tech stack

| Area           | Choices                                                                                                              |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Monorepo       | pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`                                                           |
| Frontend       | React 19, Vite, TypeScript (strict), TanStack Query + Router, Zustand, Tailwind CSS v4, shadcn/ui, Recharts, dnd-kit |
| Backend        | Hono on Node.js 22, Drizzle ORM, PostgreSQL (Neon), JWT in an HttpOnly cookie (jose)                                 |
| Shared         | Zod schemas as the single source of truth; request validation and frontend types both come from them                 |
| Quality        | Vitest, Testing Library, MSW, ESLint, Prettier, Husky + lint-staged, Conventional Commits                            |
| Infrastructure | Docker, AWS (EC2, ECR, SSM, IAM), Terraform, nginx, Cloudflare, GitHub Actions                                       |

## Architecture

- **Feature-based modules.** Each frontend feature (`apps/web/src/features/<name>`)
  holds its own API client, hooks, components, and stores, and exposes only its
  `index.ts`. Each backend feature has its own routes, service, and repository
  layers: thin Hono routes validate and delegate, services hold the business logic,
  and repositories hold the only Drizzle queries.
- **End-to-end types.** The API validates request bodies with the shared Zod
  schemas, and the web app infers its form and query types from the same schemas.
- **One origin.** The API serves the built SPA, so the auth cookie needs no
  cross-origin setup.

## Deployment

Production runs as Docker containers (the app plus nginx) on one AWS EC2 instance
behind Cloudflare. The infrastructure is defined in Terraform (`infra/`).

Every push to `main` runs the tests, builds the image, pushes it to ECR, and deploys
it through SSM. Authentication uses GitHub OIDC, so no AWS keys are stored and the
server has no SSH access. Secrets come from SSM Parameter Store. A deploy waits for
the health check and rolls back to the previous image automatically if it fails.

Full details: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Running locally

Requirements: Node.js 22, pnpm (via Corepack), and a PostgreSQL database (for
example a free Neon project).

```bash
corepack pnpm install
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL and JWT_SECRET
corepack pnpm --filter @gym-bro/api db:migrate
corepack pnpm dev
```

Web: <http://localhost:5173> · API: <http://localhost:3001>

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## License

© 2026 Krystian Gaik. All rights reserved. The source is public for reference
only; no licence to use, copy, or distribute it is granted.
