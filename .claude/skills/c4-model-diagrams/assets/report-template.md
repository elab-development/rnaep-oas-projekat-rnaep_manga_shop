# C4 Architecture — {{APP_NAME}}

_First three levels of the C4 model. Generated on {{DATE}}._

This document presents the System Context, Container, and Component views of
**{{APP_NAME}}**, following the C4 model. Each section shows a diagram and
describes what it contains and why the system is structured this way.

---

## Level 1 — System Context

![System Context diagram](c4-diagrams/01-context.svg)

**Scope.** _One paragraph: what {{APP_NAME}} is, who its users are, and which
external systems it relies on._

**Key elements.**
- _Actor — role and what they do with the system._
- _{{APP_NAME}} — the system in focus and the value it delivers._
- _External systems — each dependency and what it's used for._

**Interactions.** _Summarise the main relationships shown by the arrows._

---

## Level 2 — Container

![Container diagram](c4-diagrams/02-container.svg)

**Scope.** _What sits inside the {{APP_NAME}} boundary: the client app, the
gateway, the microservices, and their datastores._

**Containers.**
- **_Service A_** (`tech`) — _responsibility; the data it owns._
- **_Service B_** (`tech`) — _responsibility; the data it owns._
- **_Service C_** (`tech`) — _responsibility; the data it owns._
- _…UI, gateway, databases, brokers as applicable._

**Why this decomposition.** _Justify the service boundaries — what each
microservice owns, why the split is along these lines (e.g. bounded contexts,
independent scaling, team ownership), and how they communicate (sync vs. async,
protocols)._

---

## Level 3 — Components

_One subsection per microservice. Repeat for each service from Level 2._

### 3.1 — _Service A_

![Service A components](c4-diagrams/03-component-<serviceA>.svg)

**Components.**
- **_Controller / API layer_** — _entry points it exposes._
- **_Application / domain services_** — _core logic._
- **_Repository / data access_** — _persistence responsibilities._
- **_Clients / gateways_** — _calls to other services or external systems._

**Request flow.** _Walk one representative request through the components, from
the entry point to the datastore and back._

### 3.2 — _Service B_
_…same structure…_

### 3.3 — _Service C_
_…same structure…_

---

## Notes & assumptions
- _List anything inferred rather than confirmed from the codebase, so it can be corrected._
- _Diagrams are SVG (also available as PNG); regenerate with `scripts/generate_c4.py`._
