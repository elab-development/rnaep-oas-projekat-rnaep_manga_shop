---
name: eventstorming-diagrams
description: Run EventStorming (Alberto Brandolini's methodology) on user stories and render the result as a colour-coded sticky-note board (SVG/PNG) plus a written description. Use this skill whenever the user wants to "EventStorm" a domain, decompose user stories into a chronological flow of domain events, identify commands / system triggers, business policies, and group behaviour into aggregates, or asks for an "EventStorming diagram / board / model". Trigger it for domain modelling, event-driven design, or DDD discovery tasks. Produces the board directly with a bundled pure-Python generator — NO draw.io, Miro, Java, Graphviz, or browser needed.
---

# EventStorming Diagrams

Decompose user stories into an **EventStorming board**: a left-to-right timeline
of colour-coded sticky notes following Alberto Brandolini's grammar.

    Actor (yellow) → Command (blue) → Aggregate (pale yellow)
        → Domain Event (orange — the chronological backbone)
        → Policy (purple — reacts and triggers the next Command)
    Read Models (green) and External Systems (pink) attach where relevant;
    Hotspots (red) flag open questions.

Output is one SVG (and optional PNG) per board plus a Markdown write-up that
**describes the flow** — the required "decompose *and* explain". Everything is in
English. Rendering uses a bundled **pure-Python** generator: no draw.io and no
external dependencies for SVG (`cairosvg` only if you want PNG).

> The original brief may mention draw.io — ignore that tool. This skill renders
> the board itself; do not produce draw.io/Miro files.

## What the board must contain (assignment mapping)
For each user story, decompose it into, and show on the board:
- **A chronological sequence of Domain Events** — orange, past tense, ordered left→right (the backbone).
- **Commands (system triggers)** — blue, imperative; each command triggers an event.
- **Business Policies** — purple; reactive rules ("*whenever* X happened, *then* do Y") that trigger follow-up commands.
- **Aggregates** — the board groups consecutive commands/events under the aggregate that handles them (a spanning yellow sticky = the grouping).

## Workflow

### 1. Get the user stories
Use the stories the user provides. If none are given, look for them in the repo
(`docs/`, `README`, issue/ticket exports, `features/*.feature` BDD files, a
`stories`/`requirements` doc). If you still can't find any, ask the user to paste
the user stories rather than inventing a domain.

### 2. Run the EventStorming decomposition (per story)
Read `references/eventstorming-method.md` for the full method. In short, for each
story derive:
1. **Domain Events** — what *happened*, past tense ("Order Placed", "Payment Received"). Put them in the order they occur in time. This is the backbone.
2. **Commands / triggers** — the action/decision that caused each event ("Place Order"). Usually one command per event.
3. **Actors** — who issues each command (a user role or an external system).
4. **Aggregates** — the consistency boundary / entity that handles a command and emits the event ("Order", "Payment", "Cart"). Assign one to each step; consecutive steps handled by the same aggregate will be grouped automatically.
5. **Policies** — reactive business rules that listen to an event and trigger the next command ("When Payment Received → prepare shipment").
6. **Read Models** (green) and **External Systems** (pink) where a decision needs data or an outside system is involved; **Hotspots** (red) for open questions/risks.

### 3. Write the JSON spec
The spec is a list of `diagrams` (one board per user story or bounded context),
each a list of ordered `steps`. Full schema and a worked example are in
`references/eventstorming-spec.md` — read it before writing the spec. Shape:

```jsonc
{
  "diagrams": [{
    "id": "place-order",
    "title": "EventStorming — Place an Order",
    "story": "As a customer, I want to place an order so that ...",
    "steps": [
      {"actor": "Customer", "command": "Place Order", "aggregate": "Order",
       "event": "Order Placed", "policy": "When Order Placed, request payment"},
      { ... }
    ]
  }]
}
```
Each `step` is one column on the timeline. Order the steps chronologically; keep
each aggregate's steps adjacent so the grouping reads cleanly.

### 4. Render
```bash
python scripts/generate_eventstorming.py spec.json -o eventstorming
python scripts/generate_eventstorming.py spec.json -o eventstorming --png   # + PNG (needs cairosvg)
```
Writes `01-<id>.svg`, `02-<id>.svg`, … SVG needs nothing installed; for PNG,
`pip install cairosvg`.

### 5. Describe the board
Write `eventstorming.md` from `assets/report-template.md`: embed each board and,
for every story, narrate the flow (event by event), the commands that trigger the
events, the policies that make the system reactive, and why the events group into
those aggregates. Keep it in **English**.

### 6. Present
Give the user the report and board files, and note anything inferred vs. taken
from the stories/repo so they can correct it and re-render.

## Tips
- **Events are past tense; commands are imperative.** "Order Placed" (event) vs. "Place Order" (command). Getting the tense right is the fastest correctness check.
- **One backbone.** Keep events on a single chronological line; if two things happen in parallel, pick the meaningful order or split into two boards.
- **Aggregates = grouping.** Give consecutive same-aggregate steps the same `aggregate` string and they merge into one spanning sticky. Reorder steps (within what chronology allows) to keep an aggregate's steps together.
- **Policies drive the next step.** A policy on step *i* automatically draws a dashed trigger to the command on step *i+1* — so place the follow-up command in the next step.
- **Keep boards focused** — roughly 4–10 steps. Split a large story into several boards rather than one huge timeline.
- Colours/roles live in `scripts/generate_eventstorming.py` (`ROLE`); edit there to customise.
