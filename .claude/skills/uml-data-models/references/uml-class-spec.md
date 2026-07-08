# UML class-diagram spec schema

The generator (`scripts/generate_uml.py`) owns layout and UML notation. The spec
supplies the model: classes and relationships per diagram.

## Top-level shape
```jsonc
{ "diagrams": [ <diagram>, ... ] }   // one diagram per relational service
```

## Diagram object
```jsonc
{
  "id": "orders-db",                         // output filename (NN-<id>.svg)
  "title": "Orders Service — Conceptual Class Diagram (PostgreSQL)",
  "subtitle": "optional one-liner",
  "classes":       [ <class>, ... ],
  "relationships": [ <rel>, ... ]
}
```

## Class object
```jsonc
{
  "id": "order",                     // unique; referenced by relationships
  "name": "Order",
  "stereotype": "entity",            // optional; rendered as «entity»
  "tier": 1,                         // 0 = top row; layout stacks tiers top→bottom
  "order": 0,                        // optional; left→right position within a tier
  "attributes": [
    {"name": "id", "type": "UUID", "key": "PK"},
    {"name": "customerId", "type": "UUID", "key": "FK"},
    {"name": "status", "type": "OrderStatus"},
    {"name": "total", "type": "Money"}
  ],
  "operations": ["submit()", "cancel()"]   // optional; usually omitted for data models
}
```

### Attribute fields
- `name` (required), `type` (optional but recommended for a data model).
- `key`: one of `PK`, `FK`, `UK` (primary / foreign / unique). `PK` attributes are
  **underlined** and all keys get a `{PK}`/`{FK}`/`{UK}` tag on the right.
- `visibility` (optional): `public|private|protected|package` → `+ - # ~`. Usually
  omitted in conceptual models.

## Relationship object
```jsonc
{
  "from": "order",
  "to": "customer",
  "type": "association",     // association | aggregation | composition | generalization | dependency | realization
  "fromMult": "*",           // multiplicity near the `from` end
  "toMult": "1",             // multiplicity near the `to` end
  "label": "placed by",      // optional role/name shown at the midpoint
  "directed": false          // optional; open arrow at `to` for a directed association
}
```

### Relationship types & direction (important)
| type | notation | direction convention |
|------|----------|----------------------|
| `association` | plain line (optional open arrow if `directed`) | either way; use `fromMult`/`toMult` |
| `aggregation` | **hollow** diamond on the `from` end | `from` = the whole/owner, `to` = the part |
| `composition` | **filled** diamond on the `from` end | `from` = the whole/owner, `to` = the part |
| `generalization` | **hollow triangle** on the `to` end | `from` = subclass, `to` = superclass |
| `dependency` | dashed line + open arrow on `to` | `from` depends on `to` |
| `realization` | dashed line + hollow triangle on `to` | `from` realizes interface `to` |

So for "an Order is composed of OrderLines": `{"from":"order","to":"orderline","type":"composition","fromMult":"1","toMult":"1..*"}`
— the filled diamond sits on Order (the whole).

## Layout model (`tier`)
- Classes are grouped by `tier` and stacked top→bottom in ascending order.
- Within a tier, classes are laid left→right (spec order, or by `order`) and centered.
- Relationship lines connect class borders automatically, with multiplicities near
  the ends and the label on a white chip at the midpoint.
- Put "parent"/aggregate/root entities in higher (smaller) tiers and dependent
  entities below, so diamonds/triangles read top-down.

## Worked example
`assets/example-uml-spec.json` renders two relational services (Orders, Catalog),
exercising association, composition, aggregation, and generalization. Abbreviated:

```jsonc
{
  "diagrams": [{
    "id": "orders-db",
    "title": "Orders Service — Conceptual Class Diagram (PostgreSQL)",
    "classes": [
      {"id": "customer", "name": "Customer", "stereotype": "entity", "tier": 0,
       "attributes": [{"name":"id","type":"UUID","key":"PK"},
                      {"name":"email","type":"String","key":"UK"}]},
      {"id": "order", "name": "Order", "stereotype": "entity", "tier": 1,
       "attributes": [{"name":"id","type":"UUID","key":"PK"},
                      {"name":"customerId","type":"UUID","key":"FK"},
                      {"name":"total","type":"Money"}]},
      {"id": "orderline", "name": "OrderLine", "stereotype": "entity", "tier": 2,
       "attributes": [{"name":"id","type":"UUID","key":"PK"},
                      {"name":"orderId","type":"UUID","key":"FK"}]}
    ],
    "relationships": [
      {"from":"order","to":"customer","type":"association","fromMult":"*","toMult":"1","label":"placed by"},
      {"from":"order","to":"orderline","type":"composition","fromMult":"1","toMult":"1..*","label":"contains"}
    ]
  }]
}
```
