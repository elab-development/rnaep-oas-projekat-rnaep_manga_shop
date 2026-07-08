# C4 model — levels & modelling rules

The C4 model (Context, Containers, Components, Code) describes software
architecture at four levels of zoom. This skill covers the first three. Use this
as a conceptual guide while modelling; use `c4-spec.md` for the JSON schema.

## The core vocabulary
- **Person** — a human user or role that interacts with the system.
- **Software System** — the highest-level unit that delivers value; the thing you're describing, or an external one it depends on.
- **Container** — a separately runnable/deployable thing: a web app, an API/service, a **microservice**, a mobile app, a database, a message broker, a serverless function. (Not a Docker container specifically — though it often maps to one.)
- **Component** — a grouping of related functionality inside a container behind a well-defined interface: a controller, a use-case/service class, a repository, a client/gateway. Not a single class.

## Level 1 — System Context
**Question it answers:** what is this system, who uses it, and what does it depend on?
- One box for the system in focus (`system`).
- Surrounding `person`/`person_ext` actors and `system_ext` external systems.
- Relationships describe purpose in plain language ("Places orders", "Sends email via").
- **No internal detail.** Keep it to the system and its neighbours.

## Level 2 — Container
**Question:** what are the major building blocks and how do they communicate?
- Zoom into the system boundary and show its containers: UIs, APIs, **microservices**, datastores, brokers.
- Each container shows its **technology** (`tech`) and responsibility (`desc`).
- Relationships show synchronous calls (solid) and async/events (dashed), ideally with protocol in `tech` (REST, gRPC, AMQP…).
- For a microservices assignment: show **≥ 3 services**, each typically with its own datastore ("database-per-service"), plus a gateway/BFF and the client app.
- Put everything belonging to the system inside a `system` boundary.

## Level 3 — Component (one per container)
**Question:** how is a single container built internally?
- Pick a container (usually a microservice) and show its components inside a `container` boundary.
- Typical components: an API/controller layer, application/use-case services, domain services, repositories/DAOs, and clients/gateways to other containers or external systems.
- Also show the immediate neighbours the components talk to (the gateway that calls in; the database it writes to; other services it calls) as plain containers just outside the boundary, so the arrows have real endpoints.
- **Produce one such diagram for *each* microservice** identified at Level 2.

## Good-modelling checklist
- Consistent abstraction per diagram — don't mix a component into a container diagram.
- Every arrow is directed and labelled with intent; add the protocol/tech where it clarifies.
- Prefer few, meaningful boxes over exhaustive ones — legibility beats completeness.
- Name things as they're named in the codebase where possible; it makes the diagram verifiable.
- Databases as `container_db` (cylinders); externals as `system_ext` (grey).

## Describing the diagrams (the write-up)
For each level, the report should state: the diagram's scope, a walk-through of
the key elements, and the reasoning behind the decomposition. At Level 2, justify
the service boundaries (what each microservice owns, why split this way). At
Level 3, explain each component's responsibility and the request/data flow through
the container. See `assets/report-template.md`.
