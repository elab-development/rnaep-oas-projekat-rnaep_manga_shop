# EventStorming — method & how to decompose a user story

EventStorming (Alberto Brandolini) is a workshop technique for exploring a domain
by mapping **domain events** on a timeline and surrounding them with the commands,
actors, policies, aggregates, read models and external systems that explain them.
This guide is enough to decompose a user story into a correct board.

## The building blocks (and their colours)
- **Domain Event** (orange) — a fact that happened in the domain, phrased in the
  **past tense**: "Order Placed", "Payment Received". Events are the backbone and
  are arranged in the order they occur in time.
- **Command** (blue) — the intent/decision that causes an event, phrased in the
  **imperative**: "Place Order". These are the "system triggers".
- **Actor / User** (yellow) — the person or role that issues a command.
- **Aggregate** (pale yellow) — the entity or cluster that receives a command,
  enforces its rules, and emits the resulting event(s). It is a **consistency
  boundary**; it's how we *group* commands and events ("Order", "Cart", "Payment").
- **Policy** (purple) — a reactive rule: "**whenever** <event>, **then** <command>".
  Policies are what make the flow continue automatically ("When Payment Received,
  prepare shipment"). Also called process managers.
- **Read Model** (green) — the information a user (or a policy) looks at to make a
  decision ("Order Summary", "Cart View").
- **External System** (pink) — a system outside the boundary that issues commands
  or reacts to events ("Payment Gateway", "Email Service").
- **Hotspot** (red) — an open question, risk, disagreement, or unknown to revisit.

## The grammar (how they connect)
The canonical flow, repeated along the timeline:

```
Actor ─issues→ Command ─on→ Aggregate ─emits→ Domain Event ─┐
                                                            │
        (next step)  Command ←triggers─ Policy ←reacts-to───┘
```
- A command acts on exactly one aggregate; the aggregate emits one (or more) events.
- A policy reacts to an event and triggers a follow-up command (often on a
  different aggregate) — this is the reactive glue between steps.
- Read models are updated from events and read by actors/policies; external
  systems sit at the edges, sending or receiving.

## Decomposing a user story — a repeatable recipe
Take a story ("As a <role>, I want to <capability> so that <benefit>") and:

1. **List the domain events.** Walk the story from start to finish and write every
   meaningful thing that *happens*, past tense. Put them in time order. This is
   your backbone. (e.g. Item Added to Cart → Checkout Requested → Order Placed →
   Payment Received → Order Shipped → Customer Notified.)
2. **Add the command before each event.** For every event, what action/decision
   caused it? Name it imperatively (Order Placed ← "Place Order").
3. **Name the actor** that issues each command — a user role, or an external
   system for machine-initiated commands. (Some steps are triggered by a policy,
   not a human — those may have no actor.)
4. **Assign the aggregate** that handles each command/event. Ask: "what is the
   thing whose rules and state this command changes?" Give the same name to
   consecutive steps that belong together so they group (Cart, Order, Payment,
   Shipment).
5. **Find the policies.** Wherever one event should automatically cause the next
   command, write a policy: "When <event>, <do next command>". Place the triggered
   command in the following step.
6. **Add read models, external systems, hotspots** where they clarify: a screen a
   user reads before a command, an outside system that does the work, and any
   "what if…?" you can't yet answer.

## Quick correctness checks
- Every **event** is past tense; every **command** is imperative. (Fastest smell test.)
- Events read as a coherent story left→right with no time-travel.
- Each step's command and event belong to the **same aggregate**; that aggregate
  is a real consistency boundary, not just a table name.
- Policies connect an event to a **later** command, not the same step's command.
- The board is focused (≈4–10 steps). Bigger stories → multiple boards.

## Writing the description
For each board, narrate: the chronological event flow; the command (trigger) and
actor behind each event; the policies that make the system react; and the
rationale for the aggregate boundaries (what each aggregate owns and why the
events group under it). See `assets/report-template.md`.
