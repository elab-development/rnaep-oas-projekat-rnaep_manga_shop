# Data modelling guide — relational vs document, driven by quality attributes

This guide helps decide each microservice's storage from its **quality
attributes**, then model it correctly (UML class diagram for relational; JSON
schema for MongoDB).

## Choosing storage per quality attribute
Map the service's dominant quality attributes to a store. Common signals:

| Quality attribute / need | Leans **relational** (PostgreSQL, …) | Leans **document** (MongoDB) |
|--------------------------|--------------------------------------|------------------------------|
| Strong consistency, multi-row **transactions** | ✔ ACID across tables | atomic per-document only |
| Rich **relationships**, joins, referential integrity | ✔ FKs, joins | denormalize / reference by id |
| **Schema stability** & strict integrity | ✔ enforced schema | flexible, evolving schema |
| **Schema flexibility** / heterogeneous records | rigid | ✔ varying fields per doc |
| Read the **whole aggregate** in one hit | joins needed | ✔ one document read |
| **Write throughput** / horizontal scale for simple docs | scale-up / sharding effort | ✔ easy sharding |
| Hierarchical / nested data (comments, specs) | join tables | ✔ natural embedding |
| Ad-hoc analytical queries across entities | ✔ SQL | limited / aggregation pipeline |

**Polyglot persistence.** A microservice system commonly mixes both — pick per
service, not globally. For a 3-service assignment, a defensible split is two
relational services (transaction- and relationship-heavy, e.g. Orders, Catalog)
and one document service (flexible/hierarchical/high-read, e.g. Reviews, Content,
Activity, Cart). Always write down *which* quality attribute drove each choice.

## Relational modelling → UML conceptual class diagram
- One **class per entity**; attributes with domain types; mark keys `PK`/`FK`/`UK`.
- Model relationships with correct UML: **composition** (filled diamond) for
  parts that can't exist without the whole (Order → OrderLine); **aggregation**
  (hollow diamond) for a looser whole-part; **association** with multiplicities
  for general links; **generalization** (triangle) for subtype/supertype.
- Multiplicities capture cardinality (`1`, `0..1`, `1..*`, `*`). A FK typically
  implies a `*..1` association to the referenced entity.
- Keep it **conceptual**: domain-level types and the entities/keys/relationships
  that matter — not every physical column, index, or constraint. (This satisfies
  the "UML conceptual class diagram or Extended ER (EER/PMOV)" requirement; the
  class-diagram form is what this skill renders.)
- Database-per-service: each relational service owns its schema; cross-service
  links are **ids**, not FKs across databases.

See `references/uml-class-spec.md` for the spec fields.

## Document (MongoDB) modelling → JSON schema per collection
Design collections around **access patterns**, then express each as a MongoDB
`$jsonSchema` validator.

**Embed vs. reference — the core decision:**
- **Embed** when data is read together, owned by the parent document, bounded in
  size, and updated together (e.g. a review's `replies`, an order snapshot's
  line items). One read, atomic update.
- **Reference** (store the other id as a string/ObjectId) when the data is large,
  unbounded, shared across documents, updated independently, or lives in **another
  service** (e.g. `productId`, `customerId` referencing Catalog/Orders). Avoid
  cross-service joins; duplicate the few fields you need if reads demand it.

**Schema shape (`$jsonSchema`):**
- Use `bsonType` per field (`objectId`, `string`, `int`, `double`, `decimal`,
  `bool`, `date`, `array`, `object`).
- List `required` fields; constrain with `minimum`/`maximum`, `enum`, `pattern`.
- Nested documents are `object` with their own `properties`; arrays use
  `items`.
- Add `indexes` for the main query paths (e.g. `{ productId: 1, createdAt: -1 }`).
- `additionalProperties: false` if you want a strict schema; allow true for
  deliberately flexible collections.

**Key collections.** Identify the few collections that carry the service's core
data (plus any denormalized read-model/summary collections) and provide a schema
for each. See `assets/mongo-schema-template.json` (skeleton) and
`assets/example-mongo-schema.json` (a Reviews service with `reviews` and
`productRatingSummary`).

## Writing the justification
For each service the report should state: the chosen store, the **specific quality
attributes** that justify it, and the key modelling decisions (entities/keys/
relationships for relational; embed/reference choices and indexes for MongoDB).
