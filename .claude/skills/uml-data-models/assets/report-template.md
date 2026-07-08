# Data Models per Microservice — {{SYSTEM_NAME}}

_Data model for each microservice, chosen from the defined quality attributes.
Generated on {{DATE}}._

This document defines the data model for each of the three microservices. Storage
is a deliberate mix of relational and non-relational databases, chosen per
service from its quality attributes. Relational services are modelled as UML
conceptual class diagrams; the document-oriented service (MongoDB) is modelled as
JSON schemas for its key collections.

## Storage decisions at a glance
| Microservice | Store | Driven by (quality attributes) |
|--------------|-------|--------------------------------|
| {{Service A}} | PostgreSQL (relational) | {{e.g. multi-row transactions, referential integrity}} |
| {{Service B}} | PostgreSQL (relational) | {{e.g. rich relationships, ad-hoc queries}} |
| {{Service C}} | MongoDB (document) | {{e.g. flexible schema, nested data, high-read denormalized}} |

---

## 1. {{Service A}} — relational (PostgreSQL)

**Why relational.** _Tie to specific quality attributes._

![{{Service A}} class diagram](uml-diagrams/01-{{idA}}.svg)

**Entities & keys.** _Describe each entity, its primary key, and notable attributes._

**Relationships.** _Explain the associations/compositions/aggregations/
generalizations and their multiplicities (e.g. "an Order is composed of one or
more OrderLines")._

---

## 2. {{Service B}} — relational (PostgreSQL)

**Why relational.** _Tie to specific quality attributes._

![{{Service B}} class diagram](uml-diagrams/02-{{idB}}.svg)

**Entities & keys.** _…_

**Relationships.** _…_

---

## 3. {{Service C}} — document (MongoDB)

**Why document.** _Tie to specific quality attributes (flexible/nested/high-read)._

**Key collections & JSON schema.** _For each key collection, present the schema and
explain the modelling decisions:_

### `{{collection1}}`
_What it stores; what is **embedded** vs **referenced** and why; main indexes._

```json
// paste the $jsonSchema for {{collection1}} (see {{service}}-collections.schema.json)
```

### `{{collection2}}`
_…_

_Full schemas: `{{service}}-collections.schema.json` (validate with
`scripts/validate_mongo_schema.py`)._

---

## Notes & assumptions
- _List anything inferred rather than confirmed from the repo/quality attributes._
- _Diagrams are SVG (also PNG); regenerate with `scripts/generate_uml.py`. Mongo schemas validate with `scripts/validate_mongo_schema.py`._
