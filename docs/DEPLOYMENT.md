# Deployment (AWS)

Lift4Me runs in production at **https://lift4.me** on a single AWS EC2 instance, as
Docker containers, behind Cloudflare. Infrastructure is defined in Terraform
(`infra/`), and every push to `main` is tested, built, and deployed by GitHub Actions
(`.github/workflows/deploy-aws.yml`).

```
Browser ──HTTPS──▶ Cloudflare (proxy, WAF, rate limit)
                      │  HTTPS, Full (strict), Cloudflare Origin Certificate
                      ▼
            EC2 t3.micro · eu-central-1 · Ubuntu 24.04
            ┌──────────────────────────────────────────┐
            │ nginx:1.28-alpine  :80 → 301, :443 TLS   │
            │        │ proxy_pass (Docker network)     │
            │        ▼                                 │
            │ app (ECR image)    :8080 — API + SPA     │
            └──────────────────────────────────────────┘
                      │
                      ▼
               Neon PostgreSQL (pooled, eu-central-1)
```

## The app image

One image for the whole app (`Dockerfile`, node:22-slim):

1. `pnpm install --frozen-lockfile` for the workspace.
2. `pnpm --filter @gym-bro/web build` → `apps/web/dist`.
3. Runs the Hono API with `tsx` (no compile step; `@gym-bro/shared` ships TS source).

The API also serves the built SPA: with `STATIC_DIR` set, static assets come from that
directory with an `index.html` fallback for client-side routes, while `/api/*` and
`/health` stay API responses. API and SPA share one origin, so the HttpOnly auth
cookie (`SameSite=Lax`, `Secure`) needs no cross-origin CORS.

Baked into the image (not secrets): `NODE_ENV=production`, `PORT=8080`,
`STATIC_DIR=/app/apps/web/dist`.

## Infrastructure (`infra/`, Terraform)

| File              | What it defines                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `versions.tf`     | Terraform + AWS provider, S3 remote state with native locking, default tags                                |
| `network.tf`      | Own small VPC + public subnet; security group allows 80/443 **only from Cloudflare IP ranges**, no SSH     |
| `ec2.tf`          | `t3.micro`, 20 GB gp3, Elastic IP, auto-recovery                                                           |
| `cloud-init.yaml` | First boot: Docker, 2 GB swap, automatic security updates                                                  |
| `iam.tf`          | Instance role: SSM Session Manager, ECR pull, read `/lift4me/prod/*` parameters                            |
| `ecr.tf`          | `lift4me` image repository (keeps the last 5 images)                                                       |
| `github-oidc.tf`  | Keyless GitHub → AWS role, limited to this repo's `main` / `production` environment, ECR push + SSM deploy |

Server access is through **SSM Session Manager** only — no SSH port, no SSH keys.
Credentials are never in the Terraform files: locally they come from an AWS SSO
profile, in CI from the OIDC role.

## Configuration and secrets

All runtime configuration lives in **SSM Parameter Store** under `/lift4me/prod/*`
(SecureString). On every deploy, `deploy.sh` turns them into a root-only `.env` for the
app container, plus the TLS pair for nginx.

| Parameter              | Value                                                        |
| ---------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`         | Neon **pooled** connection string (host contains `-pooler`)  |
| `JWT_SECRET`           | Random string, ≥ 32 chars (`openssl rand -base64 32`)        |
| `CORS_ORIGIN`          | `https://lift4.me` (no trailing slash)                       |
| `GEMINI_API_KEY`       | Optional — photo → macros estimate                           |
| `STRAVA_CLIENT_ID`     | Optional — Strava (all three together or none)               |
| `STRAVA_CLIENT_SECRET` | Optional — Strava                                            |
| `STRAVA_REDIRECT_URI`  | Optional — `https://lift4.me/api/strava/callback`            |
| `ORIGIN_CERT`          | Cloudflare Origin Certificate (PEM) → `certs/origin.pem`     |
| `ORIGIN_KEY`           | Its private key (PEM) → `certs/origin.key`, readable by root |

The API validates its environment with Zod at boot (`apps/api/src/lib/env.ts`), so a
missing or malformed value stops the container instead of failing later.

The server uses the Neon **WebSocket Pool** driver on purpose: the app uses
interactive transactions (e.g. finishing a workout), which the HTTP driver can't do.

## CI/CD — push to `main`

`deploy-aws.yml`:

1. **Test** — install, `pnpm -r typecheck`, `pnpm -r test`.
2. **Build** — Docker Buildx builds the image and pushes it to ECR tagged with the
   commit SHA (layer cache in GitHub Actions).
3. **Deploy** — `deploy/` (`docker-compose.yml`, `nginx.conf`, `deploy.sh`) is packed
   into the SSM Run Command itself, so the server always runs the files from that exact
   commit and needs no Git access. On the server, `deploy.sh`:
   - fetches parameters → `.env` + `certs/`,
   - logs in to ECR and pulls the new image,
   - validates the nginx config (`nginx -t`) before touching anything running,
   - starts the stack and waits for the app's Docker health check (`/health`),
   - on success reloads nginx and records the image; on failure prints the app logs,
     **rolls back to the previous image**, and exits non-zero so the run goes red.

`ci.yml` runs lint, typecheck, and tests on every push and pull request.

### Rollback

GitHub → Actions → **Deploy to AWS** → _Run workflow_ with `image_tag` set to an
earlier commit SHA. The test and build steps are skipped and that image is deployed
as is.

## Database migrations

Migrations are **never** run by the deploy. Generate them with drizzle-kit, review the
SQL, and run them by hand against Neon from a local checkout:

```bash
# from the repo root, with apps/api/.env pointing at the Neon database
corepack pnpm --filter @gym-bro/api db:migrate
```

Ship schema changes in a backward-compatible order (migrate first, then deploy code
that uses the new columns), since there is a single running instance and no
blue/green.

## Verify after a deploy

- `https://lift4.me/` loads the SPA.
- `https://lift4.me/health` returns `{"data":{"status":"ok"}}`.
- Log in to confirm an `/api/...` round-trip and the auth cookie.
- Logs: SSM session to the instance → `cd /opt/lift4me && docker compose logs -f app`.

## Cost and limits

- One `t3.micro` (1 GB RAM + 2 GB swap). The app container is capped at 640 MB with
  Node's heap at 384 MB, so a leak can't take the host down.
- An AWS budget alert watches monthly spend.
- Single instance, single AZ: a deploy restarts the app (a few seconds of downtime),
  and EC2 auto-recovery covers a failed host.

## Local development

`STATIC_DIR` is unset locally, so the API serves only `/api` and `/health`, and Vite
serves the SPA:

```bash
corepack pnpm install
corepack pnpm dev      # web on :5173, API on :3001
```

## History

1. Netlify — static SPA + one Netlify Function.
2. Fly.io — the same single image as one Fly app (`fly.toml`, `deploy.yml`). Kept
   running in parallel during the move and being retired.
3. AWS — the current setup above, built to mirror a typical company production
   deploy: infrastructure as code, keyless CI, no SSH, secrets in Parameter Store,
   health-checked deploys with automatic rollback.
