# Canvas spec schema & section guide

Read this when filling in the JSON spec. The render script owns layout, colors,
and positions — the spec only supplies content.

## Spec schema

```jsonc
{
  "title": "string",        // shown large in the header
  "subtitle": "string",     // optional; version / date / owner line
  "sections": {             // all keys optional; missing/empty → renders as "—"
    "<section_key>": ["item", "item", ...]   // or a single "string"
  }
}
```

- Items are plain strings; no markdown is rendered.
- Aim for 3–6 concise items per section (phrases, not sentences).
- Text wraps automatically; boxes that overflow show a `…more` hint — trim then.

## The four bands and eleven sections

Sections are grouped into four colored bands. Positions are fixed.

### Context band (top row) — *who and why*
| key | title | what goes here |
|-----|-------|----------------|
| `stakeholders` | Stakeholders & Users | Who uses or depends on the system: user types, admins, ops, partners, downstream teams. |
| `goals` | Business Goals & Value | The outcomes the system exists to deliver; the "why". Business/product goals, not tech. |
| `constraints` | Constraints & Assumptions | Hard limits and given assumptions: budget, team size, compliance, existing platforms, deadlines, data residency. |

### System band (middle row) — *what it's made of*
| key | title | what goes here |
|-----|-------|----------------|
| `external` | External Systems & Integrations | Third-party services and systems it talks to: identity, payments, email, storage, LLM APIs, partner APIs. |
| `components` | Core Components & Modules | The main internal building blocks: frontends, services, gateways, workers, engines, key libraries. |
| `data` | Data & Storage | Where state lives: databases, caches, search indexes, blob stores, queues/event logs, and key data entities. |

### Foundations band (third row) — *what it's built on*
| key | title | what goes here |
|-----|-------|----------------|
| `techstack` | Technology Stack | Languages, frameworks, runtimes, major tools, IaC. The concrete tech choices. |
| `quality` | Quality Attributes (NFRs) | Non-functional requirements and targets: performance/latency, availability, scalability, security posture, maintainability. Include numbers where known. |
| `crosscutting` | Cross-cutting Concerns | Concerns that span components: authn/authz, logging, tracing, monitoring, rate limiting, error handling, encryption, i18n. |

### Operations band (bottom row) — *how it runs and evolves*
| key | title | what goes here |
|-----|-------|----------------|
| `decisions` | Architecture Decisions & Risks | Key architectural decisions (reference ADRs if they exist) and the main risks / open questions / tech debt. This box spans two columns. |
| `deployment` | Deployment & Infrastructure | Where and how it runs: cloud/region, orchestration, CI/CD, environments, release strategy. |

## Sourcing tips (repo → section)

- `README`, `/docs`, `/adr` or `/docs/decisions` → `goals`, `constraints`, `decisions`.
- Dependency manifests → `techstack`, `components`.
- `.env.example`, config, SDK imports → `external`, `data`, `crosscutting`.
- `Dockerfile`, `*.tf`, `k8s/`, `serverless.yml`, `.github/workflows` → `deployment`.
- Migrations / ORM models / `schema.*` → `data`.
- Middleware, gateway, auth modules → `crosscutting`.
- Perf configs, SLA docs, load-test configs → `quality`.

When the repo is silent on business context (`stakeholders`, `goals`, some
`constraints`), infer conservatively or ask one short question. Prefer an honest
`"— (confirm with team)"` item over a fabricated specific.
