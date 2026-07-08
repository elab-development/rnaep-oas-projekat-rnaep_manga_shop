# C4 spec schema & element reference

The generator (`scripts/generate_c4.py`) owns layout and styling. The spec only
supplies the model: nodes, boundaries, and relationships per diagram.

## Top-level shape

```jsonc
{
  "app": "MyApp",                 // optional, informational
  "diagrams": [ <diagram>, ... ]  // one object per diagram; rendered in order
}
```

## Diagram object

```jsonc
{
  "id": "container",              // used in the output filename (NN-<id>.svg)
  "level": 2,                     // 1 | 2 | 3 (informational)
  "title": "Level 2 — Container: MyApp",
  "subtitle": "optional one-liner shown under the title",
  "boundaries": [ <boundary>, ... ],  // optional
  "nodes":      [ <node>, ... ],
  "rels":       [ <rel>, ... ]
}
```

## Node object

```jsonc
{
  "id": "orders",            // unique within the diagram; referenced by rels & boundary members
  "type": "container",       // see element types below
  "name": "Orders Service",
  "tech": "Java / Spring",   // optional; shown as [Container: Java / Spring]
  "desc": "Cart, checkout, order lifecycle",  // optional short description
  "tier": 3,                 // 0 = top row; layout stacks tiers top→bottom
  "order": 1,                // optional; left→right position within its tier
  "boundary": "ss"           // optional; id of the boundary this node sits inside
}
```

### Element types (`type`)
| type | renders as | use for |
|------|-----------|---------|
| `person` | dark-blue figure | internal users/actors |
| `person_ext` | grey figure | external users |
| `system` | blue box | **the** system in focus (Level 1), or an internal system |
| `system_ext` | grey box | external/third-party systems (Stripe, Auth0, …) |
| `container` | medium-blue box | a deployable/runnable unit: web app, API, microservice, worker |
| `container_db` | medium-blue **cylinder** | a database / datastore |
| `container_queue` | medium-blue box | a message broker / queue |
| `component` | light-blue box | an internal component of a container (Level 3) |
| `component_db` | light-blue cylinder | a component that is a store |

The `[Type: tech]` tag under each name is derived automatically from `type` + `tech`.

## Boundary object
Groups nodes with a dashed rounded rectangle and a label. Used for the **system
boundary** at Level 2 and the **container boundary** at Level 3.

```jsonc
{ "id": "ss", "label": "MyApp", "type": "system" }   // type: "system" | "container"
```
A node is placed inside a boundary by setting its `boundary` to the boundary's `id`.
The boundary rectangle is computed automatically to enclose its members.

## Relationship object
A directed, labeled arrow from one node to another.

```jsonc
{
  "from": "gateway",
  "to": "orders",
  "label": "Routes requests to",
  "tech": "gRPC",            // optional; shown italic under the label as [gRPC]
  "style": "dashed"          // optional; "dashed" for async/event relationships
}
```

## Layout model (how `tier` works)
- Nodes are grouped by `tier`; tiers are stacked top→bottom in ascending order.
- Within a tier, nodes are laid left→right (spec order, or by `order`) and the row is centered.
- Arrows are routed straight between box borders, with the label on a white chip at the midpoint.
- **Design by flow:** put actors/users at tier 0, then entry points (UI, gateway), then services, then datastores and externals at the bottom. This keeps most arrows pointing downward and readable.

## Worked example (abbreviated)

```jsonc
{
  "app": "ShopSphere",
  "diagrams": [
    {
      "id": "context", "level": 1, "title": "Level 1 — System Context: ShopSphere",
      "nodes": [
        {"id": "customer", "type": "person", "name": "Customer", "tier": 0},
        {"id": "sys", "type": "system", "name": "ShopSphere", "desc": "Online store", "tier": 1},
        {"id": "stripe", "type": "system_ext", "name": "Stripe", "desc": "Payments", "tier": 2}
      ],
      "rels": [
        {"from": "customer", "to": "sys", "label": "Buys via", "tech": "HTTPS"},
        {"from": "sys", "to": "stripe", "label": "Charges", "tech": "REST"}
      ]
    },
    {
      "id": "container", "level": 2, "title": "Level 2 — Container: ShopSphere",
      "boundaries": [{"id": "ss", "label": "ShopSphere", "type": "system"}],
      "nodes": [
        {"id": "spa", "type": "container", "name": "Web Storefront", "tech": "React", "tier": 0, "boundary": "ss"},
        {"id": "gw", "type": "container", "name": "API Gateway", "tech": "Node.js", "tier": 1, "boundary": "ss"},
        {"id": "catalog", "type": "container", "name": "Catalog Service", "tech": "Go", "tier": 2, "boundary": "ss"},
        {"id": "orders", "type": "container", "name": "Orders Service", "tech": "Java", "tier": 2, "boundary": "ss"},
        {"id": "payments", "type": "container", "name": "Payments Service", "tech": "Python", "tier": 2, "boundary": "ss"},
        {"id": "db", "type": "container_db", "name": "Orders DB", "tech": "PostgreSQL", "tier": 3, "boundary": "ss"}
      ],
      "rels": [
        {"from": "spa", "to": "gw", "label": "Calls", "tech": "JSON/HTTPS"},
        {"from": "gw", "to": "catalog", "label": "Routes"},
        {"from": "gw", "to": "orders", "label": "Routes"},
        {"from": "gw", "to": "payments", "label": "Routes"},
        {"from": "orders", "to": "db", "label": "Reads/writes", "tech": "SQL"}
      ]
    }
    // ...then one Level-3 component diagram per microservice (catalog, orders, payments)
  ]
}
```

See `assets/example-spec.json` for the full three-level example that renders the
sample diagrams shipped with this skill.
