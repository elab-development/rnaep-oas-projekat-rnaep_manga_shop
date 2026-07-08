# EventStorming spec schema & example

The generator (`scripts/generate_eventstorming.py`) owns layout and the colour
grammar. The spec supplies the model only: an ordered list of steps per board.

## Top-level shape
```jsonc
{
  "diagrams": [ <board>, ... ]   // one board per user story or bounded context
}
```

## Board object
```jsonc
{
  "id": "place-order",                 // used in the output filename (NN-<id>.svg)
  "title": "EventStorming — Place an Order",
  "story": "As a customer, I want to place an order so that my items ship.",
  "steps": [ <step>, ... ]             // ordered left→right in time
}
```

## Step object
One step = one column on the timeline. All fields are optional except that a step
should have at least an `event` or a `command`. Empty fields are simply omitted
from that column, and roles unused by *every* step don't get a row at all.

```jsonc
{
  "actor":      "Customer",                       // yellow — who triggers the command
  "command":    "Place Order",                    // blue  — imperative trigger
  "aggregate":  "Order",                          // pale yellow — the handling aggregate
  "event":      "Order Placed",                   // orange — past tense (the backbone)
  "policy":     "When Order Placed, request payment", // purple — reactive rule → next command
  "read_model": "Order Summary",                  // green — data a user/decision reads
  "external":   "Payment Gateway",                // pink  — external system involved
  "hotspot":    "What if the order is fraudulent?" // red   — open question / risk
}
```

### The vertical grammar (per column, top→bottom)
`actor → command → aggregate → event → policy`. The generator draws light
connectors down this chain for whatever elements a step contains, so a reader can
follow "who did what, on which aggregate, producing which event, and which policy
reacted".

### The two automatic relationships
- **Chronological backbone:** an orange arrow links each `event` to the next
  step's `event`, left→right — the chronological sequence of events.
- **Reactive trigger:** a dashed purple arrow links a step's `policy` to the
  **next** step's `command` — "the policy triggers the following command". So put
  the command that a policy triggers in the *next* step.

### Aggregate grouping
Consecutive steps that share the same `aggregate` string are merged into a single
spanning aggregate sticky (with a dashed grouping outline). That merged sticky is
the visual "grouping into aggregates". To group cleanly, keep a given aggregate's
steps adjacent in the `steps` list (chronology permitting). Non-adjacent repeats
of an aggregate simply produce separate stickies.

## Colour grammar (fixed)
| field | colour | meaning |
|-------|--------|---------|
| `event` | orange | a domain event — something that happened (past tense) |
| `command` | blue | a command / system trigger — imperative intent |
| `aggregate` | pale yellow | the aggregate (consistency boundary) handling the command |
| `actor` | yellow | the user/role issuing the command |
| `policy` | purple | a reactive business rule (whenever… then…) |
| `read_model` | green | information a user/decision reads |
| `external` | pink | an external system |
| `hotspot` | red | an open question, risk, or conflict |

## Worked example
`assets/example-spec.json` is a full "Place an Order" board spanning the Cart,
Order, Payment, and Shipment aggregates, with two policies, three read models,
external systems, and a hotspot — it renders the sample board shipped with this
skill. Reproduced here in brief:

```jsonc
{
  "diagrams": [{
    "id": "place-order",
    "title": "EventStorming — Place an Order",
    "story": "As a customer, I want to place an order and pay for it so that my items are shipped.",
    "steps": [
      {"actor": "Customer", "command": "Add Item to Cart", "aggregate": "Cart",
       "event": "Item Added to Cart", "read_model": "Cart View"},
      {"actor": "Customer", "command": "Checkout Cart", "aggregate": "Cart",
       "event": "Checkout Requested"},
      {"command": "Place Order", "aggregate": "Order", "event": "Order Placed",
       "policy": "When Order Placed, request payment", "read_model": "Order Summary"},
      {"command": "Take Payment", "aggregate": "Payment", "event": "Payment Received",
       "external": "Payment Gateway", "policy": "When Payment Received, prepare shipment",
       "hotspot": "What if payment is declined?"},
      {"command": "Ship Order", "aggregate": "Shipment", "event": "Order Shipped",
       "external": "Courier API", "read_model": "Tracking View"},
      {"command": "Notify Customer", "aggregate": "Shipment", "event": "Customer Notified",
       "external": "Email Service"}
    ]
  }]
}
```
