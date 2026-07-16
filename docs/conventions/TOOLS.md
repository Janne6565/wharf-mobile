<!-- AUTO-SYNCED from agents KB: TOOLS.md @ 3f889bd.
     Do NOT edit here — edit the source in ~/projects/agents and re-run scripts/sync-conventions.sh. -->

# Tools & Standard Stack

The default toolbox across projects. When starting something new, reach for the
**bold** default unless there's a reason not to. Framework-specific conventions live
in [`technologies/`](technologies/); cross-cutting infra in [`concepts/`](concepts/).

## Frontend

- **Language/build:** TypeScript + **Vite**, package manager **Bun** (older projects
  use npm/pnpm). Linting/formatting via **Biome** (newer) or ESLint + Prettier (older).
- **Framework:** **React** (v19 on recent projects). React Native + Expo for mobile
  (Bobs Archiv). Vue.js only in legacy projects (Syncup, Lethal Habit landing).
- **Routing:** **TanStack Router** (with `beforeLoad` guards); React Router on older apps.
- **Server state:** **TanStack Query** (React Query). **Client/UI state:** **Redux
  Toolkit** (+ redux-persist / localforage where offline caching is needed).
- **Styling/UI:** **Tailwind CSS + shadcn/ui + Radix + lucide-react** is the standard.
  Material UI (+ Joy) appears in older/team projects (Bitfrost, Medals, SAU-Portal).
- **Forms:** react-hook-form + **Zod**. **i18n:** react-i18next with typed
  `resources.ts` (see [technologies/REACT.md](technologies/REACT.md)).
- **API client:** **Orval** generates a typed client from the backend OpenAPI spec.
- **Viz/misc:** Recharts / MUI X Charts, Three.js (Blockworks), xyflow (Architecture
  Studio), GSAP / Reanimated / Moti for animation, dnd-kit for drag-and-drop.

## Backend

- **Primary:** **Java 21 + Spring Boot (Maven)** + Lombok. See
  [technologies/SPRING_BOOT.md](technologies/SPRING_BOOT.md).
- **Web:** Spring **Web MVC** by default; **WebFlux** (reactive) for
  IO/scrape-heavy services (Covered, Bitfrost, Robert Space Tracker, parts of Cosy).
- **Auth:** Spring Security + **JWT** (jjwt). Bitfrost runs its own OAuth2 auth
  server; SAU-Portal uses **Keycloak** (OIDC) — the two exceptions.
- **Data:** Spring Data JPA, **Flyway** migrations, **PostgreSQL** in prod / **H2**
  for tests. InfluxDB for time-series (Cosy), Loki for logs.
- **Docs/metrics:** springdoc-openapi (feeds Orval), Micrometer → Prometheus.
- **Other integrations:** AWS SDK Route53 + Stripe (Cosy Domain Provider), OpenFeign
  / WebClient for outbound HTTP, Bucket4j + Caffeine for rate limiting, Mailgun /
  Spring Mail for email, fabric8 kubernetes-client (Strata), TOTP for 2FA.
- **Other languages** (Cosy only, polyglot): **Rust** (actix-web), **Go** (Gin),
  **Kotlin** (Fabric Minecraft mod).

## Infra, DevOps & platform

- **Containers:** Docker, images to **ghcr.io**, served behind **nginx** (frontends).
- **Orchestration:** **Kubernetes (k3s)**, manifests via **Kustomize**
  (base + overlays). See [concepts/CLUSTER.md](concepts/CLUSTER.md).
- **GitOps/CD:** **ArgoCD** (app-of-apps). CI: **GitHub Actions**. Watchtower on
  legacy Medals only. See [concepts/CICD.md](concepts/CICD.md).
- **Ingress/TLS:** Traefik + cert-manager. **Secrets:** Sealed Secrets (`kubeseal`).
- **Observability:** **SigNoz** (OpenTelemetry-native — traces/metrics/logs) is the
  standard; new projects instrument with OTLP and dashboard in SigNoz. See
  [concepts/MONITORING.md](concepts/MONITORING.md). Legacy kube-prometheus-stack
  (Prometheus/Grafana) + Loki run in parallel during migration, being decommissioned.
  **Storage:** MinIO (S3). **Backups:** Velero. **Automation:** n8n.

## Testing

- **Backend:** JUnit 5 + Mockito + AssertJ; `@DataJpaTest`; Testcontainers (Strata).
- **Frontend:** **Vitest** + Testing Library (unit), **Playwright** or Cypress (E2E).

## Agent / AI tooling

- **MCP servers** are a recurring pattern the user builds: `project-manager-mcp`
  (exposes the project catalog to agents — the source for [projects/](projects/)),
  the Blockworks/minecraft MCP server, and the dust-of-apollon admin MCP.
- This knowledge base itself lives in the `agents` repo and is meant to be loaded as
  agent context.
