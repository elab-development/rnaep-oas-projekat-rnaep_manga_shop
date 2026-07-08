---
name: c4-model-diagrams
description: Create the first three levels of C4 model architecture diagrams (Level 1 System Context, Level 2 Container, Level 3 Component) for an application, rendered as SVG/PNG plus written descriptions. Use this skill whenever the user asks for "C4 diagrams", "C4 model", "system context / container / component diagram", "architecture diagrams", or to model/decompose an app into systems, containers, microservices, and components. Trigger it for requests to decompose a system into at least three microservices and break each container down to component level. Inspects the codebase to model real containers and components, then renders with a bundled pure-Python generator (no Java, Graphviz, or browser needed).
---

# C4 Model Diagrams

Produce the first three levels of the **C4 model** (by Simon Brown) for an app:

1. **Level 1 — System Context**: the system as one box, its users (people), and the external systems it talks to.
2. **Level 2 — Container**: the system decomposed into deployable/runnable units — web apps, APIs, **microservices**, databases, queues — and how they interact.
3. **Level 3 — Component**: **one diagram per container/microservice**, decomposing it into internal components (controllers, services, repositories, gateways, etc.).

Output is one SVG (and optional PNG) per diagram, plus a Markdown report that
embeds the diagrams and **describes each level in prose** ("create *and* describe").

Rendering uses a bundled pure-Python generator — **no external dependencies** for
SVG (optional `cairosvg` for PNG). You fill a JSON spec; the script owns layout.

## Meeting the common assignment requirements
If the task is to model "at least three microservices" and decompose "each
container to component level", make sure:
- The **Level 2** diagram contains **≥ 3 microservice containers** (plus their datastores and any gateway/UI).
- There is **one Level 3 component diagram for *each* microservice** — so ≥ 3 component diagrams. Do not stop at one.

## Workflow

### 1. Model the system from the codebase
The diagrams are only as good as the model. Inspect (as available):
- **README / docs / ADRs** — the system's purpose, boundaries, external systems.
- **Repo layout** — a monorepo's `services/*`, `apps/*`, or separate deployables → **containers**. Each service's internal folders (`controllers/`, `handlers/`, `services/`, `repositories/`, `domain/`) → **components**.
- **Dependency manifests** (`package.json`, `pyproject.toml`, `go.mod`, `pom.xml`, …) → each service's language/framework (the container's "technology").
- **`docker-compose*.yml`, `k8s/`, `helm/`** — the clearest container inventory: each service, database, cache, broker is a container.
- **`.env.example`, SDK clients, config** — external systems (Stripe, Auth0, S3, SendGrid, OpenAI) and datastores (Postgres, Redis, Kafka).
- **Inter-service calls** (HTTP/gRPC clients, message publishers/consumers) → the **relationships** (arrows) between containers.
- **Within a service**: route/controller files, service/use-case classes, repository/DAO classes, external clients → that service's **components** and their wiring.

If something isn't in the repo (e.g. real end users, business context), infer
conservatively or ask one short question rather than inventing specifics.

### 2. Write the JSON spec
Create a spec with a `diagrams` array — typically 1 context + 1 container +
N component diagrams (one per microservice). Full schema, element types, and a
worked example are in **`references/c4-spec.md`** — read it before writing the spec.

Key ideas (see the reference for the rest):
- Each node has a `type` (`person`, `system`, `system_ext`, `container`, `container_db`, `component`, …), a `name`, optional `tech` and `desc`, and a **`tier`** (0 = top row). Tiers drive the layout, so order them by flow: people on top, then UI/gateway, then services, then datastores/externals.
- `boundaries` group nodes (the system boundary at L2; the container boundary at L3). A node joins one via its `boundary` field.
- `rels` are directed arrows: `{from, to, label, tech?, style?}`.

### 3. Render
```bash
python scripts/generate_c4.py spec.json -o c4-diagrams            # SVGs
python scripts/generate_c4.py spec.json -o c4-diagrams --png      # + PNGs (needs cairosvg)
```
Writes `01-<id>.svg`, `02-<id>.svg`, … in the output dir. SVG needs nothing
installed; for PNG, `pip install cairosvg`.

### 4. Write the report ("describe")
Create `c4-architecture.md` using **`assets/report-template.md`** as the skeleton.
For each level, embed the diagram and write the description: what it shows, the
key elements, and — for L2/L3 — justify the decomposition (why these
microservices, what each owns, how they interact). Keep it in **English**.

### 5. Present
Give the user the report and the diagram files, and note anything you inferred vs.
read from the repo so they can correct the model and re-render.

## Notes & tips
- **Keep each diagram small.** C4 is about focus per level — aim for ≤ ~12 boxes. If a container diagram gets crowded, that's a signal the boundary is too broad.
- **Consistent tech labels.** Put the runtime/framework in `tech` (e.g. `Java / Spring`, `Go`, `PostgreSQL`) — it renders as the element's `[Container: …]` tag.
- **Databases & queues**: use `container_db` (renders as a cylinder). Externals use `system_ext` (grey).
- **Layout control**: nodes are auto-centered per tier in spec order; add `"order": N` to force left-to-right position within a tier. If two tiers of very different widths look unbalanced, even out the counts or add a tier.
- The generator, palette, and element types live in `scripts/generate_c4.py`; edit `STYLES`/`TYPE_TAG` there to customize.
- C4 defines two further levels (Code, e.g. class diagrams) — out of scope here; mention them only if asked.
