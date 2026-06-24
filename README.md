# Manga Web Shop

An online shop for physical manga volumes — NestJS microservices behind an API
gateway with a Next.js frontend. Authoritative decisions live in `docs/adr/`
(ADR-0001…0013); domain vocabulary in `CONTEXT.md`; the master PRD and issues in
`.scratch/manga-shop/`.

## Layout

A pnpm + Turborepo monorepo (ADR-0001):

| Workspace                  | Role                                              | DB        | Port |
| -------------------------- | ------------------------------------------------- | --------- | ---- |
| `apps/gateway`             | Thin API gateway (JWT, CORS, routing) — ADR-0011  | —         | 3000 |
| `apps/auth`                | Users, roles, JWT issuance                        | Postgres  | 3001 |
| `apps/catalog`             | Manga, stock, Jikan/Frankfurter                   | MongoDB   | 3002 |
| `apps/orders`              | Cart, orders, order status                        | Postgres  | 3003 |
| `apps/payments`            | Stripe payments + payment events                  | Postgres  | 3004 |
| `apps/web`                 | Next.js storefront + admin/moderator panels       | —         | —    |
| `packages/contracts`       | Shared event/DTO contracts (Kafka-aware)          | —         | —    |
| `packages/auth-guard`      | Shared JWT strategy + role guards (ADR-0007/0005) | —         | —    |

## Develop

```bash
pnpm install
pnpm typecheck   # type-check every workspace
pnpm lint        # lint every workspace
pnpm test        # run each service's tests (builds shared packages first)
```

## Run the full stack

`docker compose` brings up all five services, a database per service, Kafka,
Prometheus, and Grafana as separate containers (ADR-0001):

```bash
docker compose up --build
```

### Boot smoke check

Slice 01 only proves "everything boots". Each service exposes a `/health`
endpoint (also wired as its container healthcheck). Once `docker compose ps`
shows the services healthy, confirm each one:

```bash
for port in 3000 3001 3002 3003 3004; do
  echo "port $port:" && curl -s "http://localhost:$port/health"; echo
done
# each should print: {"status":"ok","service":"<name>"}
```

Prometheus is at <http://localhost:9090>, Grafana at <http://localhost:3030>
(admin/admin). Service `/metrics` endpoints land in slice 12.
