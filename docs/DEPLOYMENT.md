# Deployment and monitoring

The requested deployment deliverables are prepared files only. No website, image or repository has been published.

## Local Docker stack

Start Docker Desktop, then from the project root:

```powershell
npm.cmd run docker:setup
docker compose --env-file deploy/compose.env config --quiet
npm.cmd run docker:up
```

Open http://localhost:8080. A separate PostgreSQL container stores data in the `taskflow-data` volume. It does not access the native database configured in `backend/.env`.

`docker:setup` generates a random URL-safe database password and a random metrics token in ignored local files. It never overwrites an existing database password. The metrics token also goes into `deploy/metrics-token` so the unprivileged Prometheus process can read it. Do not commit or distribute either generated file. These settings are for local HTTP use; `SECURE_COOKIES=false` is intentional only for this local example.

The `migrate` service waits for PostgreSQL health, applies the additive schema, then exits. The app waits for that migration to succeed. The app image runs as the unprivileged `node` user and serves both the compiled React app and API on one origin.

Useful commands:

```powershell
docker compose --env-file deploy/compose.env ps
docker compose --env-file deploy/compose.env logs --tail 100 app
docker compose --env-file deploy/compose.env logs migrate
npm.cmd run docker:down
```

Stopping the stack preserves volumes. Do not use `down -v` unless you explicitly intend to erase Docker database and metrics storage.

## Monitoring

```powershell
docker compose --env-file deploy/compose.env --profile monitoring up -d
```

Open http://localhost:9090. Prometheus scrapes the app every 15 seconds using its bearer token. Queries to try:

- `up{job="taskflow"}`: scrape availability.
- `rate(taskflow_http_requests_total[5m])`: request rate.
- `rate(taskflow_http_errors_total[5m])`: server error rate.
- `rate(taskflow_http_duration_seconds_total[5m]) / clamp_min(rate(taskflow_http_requests_total[5m]), 0.001)`: mean response duration.
- `taskflow_uptime_seconds`: process uptime.

Verify the running stack without changing application data:

```powershell
npm.cmd run docker:verify -- --monitoring
```

This checks database readiness, frontend assets, access protection, authenticated metrics, a successful Prometheus scrape and loaded alert rules. Without the monitoring service, use `npm.cmd run docker:verify`.

Run the integration suite using the built Linux image and container database:

```powershell
$taskflowTestPath = (Resolve-Path backend/test).Path
docker compose --env-file deploy/compose.env run --rm --no-deps -v "${taskflowTestPath}:/app/backend/test:ro" migrate node --test test/database.test.js test/features.test.js
```

This uses a temporary test schema and leaves application data intact.

The included alert rules flag an unavailable app after two minutes and a sustained server-error fraction above five percent. These alerts are visible in Prometheus; external delivery requires configuring Alertmanager, which is not bundled. Metrics counters are per process and reset on restart. `/api/health` separately checks the database; use an uptime service against that route for end-to-end availability.

The health and metrics endpoints never return task/user details. `/api/metrics` returns 404 unless a configured `METRICS_TOKEN` is supplied as a bearer token. No metrics token means metrics are disabled. All example published ports bind to 127.0.0.1.

## GitHub Actions

This downloaded workspace is not yet a Git repository. When you put it in a repository:

1. `ci.yml` runs on pull requests, pushes to `main`/`master`, and manual dispatch. It uses an isolated PostgreSQL service, runs unit/integration tests, builds the frontend and Docker image, validates Compose, reruns integration tests inside the built image and checks the running application and Prometheus stack.
2. `release.yml` is manual. It reruns tests/builds, then publishes the image to `ghcr.io/<owner>/<repository>` tagged with the commit SHA and `latest`, using the job's GitHub token. It does not expose a running app or deploy automatically.
3. Protect the default branch and require the verification job before merging. Review the release workflow before triggering publication.

No GitHub workflow has been executed from this local workspace. Its first remote run is part of deployment verification.

## Hosting checklist for later

- Choose a hosting account and repository. Keep credentials in the host's secret store.
- Use a managed PostgreSQL database or a backed-up persistent volume. Run `node scripts/init-db.js` as a release migration before starting the new app version.
- Serve the container behind HTTPS; set `FRONTEND_ORIGIN=https://your-domain.example`, `SECURE_COOKIES=true`, and `SERVE_FRONTEND=true`.
- Set `TRUST_PROXY=true` only behind one controlled reverse proxy that replaces untrusted forwarding headers. Leave it false for direct access. Login throttling relies partly on the client IP.
- Keep PostgreSQL and monitoring private. Configure TLS to the database as required by your provider; do not disable certificate validation.
- Configure backups and test restoring them before importing important data.
- Confirm registration/login, session restoration, team isolation, project assignment, health and metrics in staging before switching public traffic.
- Add verified email, forgotten-password recovery and MFA if the intended public deployment needs them. These are not part of the supplied checklist implementation.

## Implementation references

- Password hashing uses Node's [scrypt API](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback) with the N=2^15, r=8, p=3 configuration listed in the [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- Service dependencies follow [Docker Compose health and startup ordering](https://docs.docker.com/compose/how-tos/startup-order/).
- The release workflow follows [GitHub Container Registry publishing guidance](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
- Monitoring verification uses the [Prometheus HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/); container integration tests use [Docker Compose run](https://docs.docker.com/reference/cli/docker/compose/run/).

## Local verification status

On 20 October 2026, the frontend build, unit tests and PostgreSQL integration tests passed. Docker Desktop was started, the image built, migrations completed and both database and application containers became healthy. The integration suite passed again inside the Linux image. Deployment verification confirmed the built frontend/assets, authentication protection, protected metrics, a successful Prometheus scrape and both loaded alerts. `promtool` validated the monitoring configuration and rules.

Earlier browser feature checks passed. The appearance review used screenshots of desktop and narrow-window views, which showed no obvious overlaps or horizontal clipping. Screenshot review does not replace interaction testing. GitHub workflows have not been run remotely, and nothing has been published. See `docs/IMPLEMENTATION-STATUS.md` for the final checkpoint and verification limits.

## New feature upgrade

Rebuild the stack with `docker compose --env-file deploy/compose.env --profile monitoring up -d --build --wait`. The migration adds attachment, activity, dependency and milestone tables plus task dates and account roles. Do not remove the database volume. Attachments are PostgreSQL BYTEA data and are included in ordinary database backups; plan storage accordingly.

After registering your account in the Docker app, bootstrap its administrator role with:

```powershell
docker compose --env-file deploy/compose.env exec app npm run db:make-admin -- your@email.com
```

Sign in again. The native and Docker databases are separate, so an administrator in one is not automatically an administrator in the other.

The new-version rebuild, migration, all 19 integration tests in the container, and the application/Prometheus smoke checks passed locally on 20 October 2026. Browser checks of the new screens remain outstanding. See `NEW-FEATURES.md` for file limits, permissions, analytics definitions and timeline behavior.
