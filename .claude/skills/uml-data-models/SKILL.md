---
name: uml-data-models
description: Design per-microservice data models and render them — UML conceptual class diagrams (SVG) for relational databases, and JSON schemas for document (MongoDB) collections. Use this skill whenever the user wants a data model / database model for one or more services, a UML class diagram or conceptual/EER model of a relational schema, entity models with attributes, keys (PK/FK/UK) and relationships, or a JSON schema for MongoDB collections. Trigger it for "data model", "class diagram", "ER/EER diagram", "database schema", "polyglot persistence", or choosing relational vs non-relational storage per quality attributes. Renders with a bundled pure-Python generator — NO draw.io, Java, Graphviz, or browser needed.
---

# UML Data Models (relational class diagrams + MongoDB JSON schemas)

Design the **data model for each microservice** and produce the deliverables:
- **Relational services** → a **UML conceptual class diagram** (SVG/PNG): entities with typed attributes, keys (PK/FK/UK), and UML relationships (association, aggregation, composition, generalization) with multiplicities.
- **Document service (MongoDB)** → a **JSON schema for each key collection** (MongoDB `$jsonSchema` validator form), capturing embedding vs. referencing and constraints.
- A **write-up** that justifies each storage choice against the **quality attributes**.

Rendering is **pure Python** — no draw.io and no external dependencies for SVG
(`cairosvg` only for optional PNG). You fill JSON specs; the script owns layout.

> The original brief may mention draw.io — ignore that tool. This skill renders
> the diagrams itself; do not produce draw.io files.

## Assignment mapping (typical: 3 microservices)
- Model **all three** services and make the storage a **deliberate mix** of relational and non-relational — e.g. two relational (UML class diagrams) + one MongoDB (JSON schemas). The exact split follows from the quality attributes; justify it.
- **Every** service must have a defined model. Don't leave one unspecified.
- Tie each choice to quality attributes (see `references/data-modeling-guide.md`): strong consistency + rich relationships + transactions → relational; flexible/evolving schema, denormalized high-throughput reads, hierarchical documents → document (MongoDB).

## Workflow

### 1. Establish the services and their quality attributes
Use the services and quality attributes the user/repo already defines (a prior
architecture doc, C4 model, ADRs, `docker-compose`/manifests). If the quality
attributes aren't given, ask for them briefly — they drive the relational vs.
document decision, so don't guess silently.

### 2. Decide storage per service (and record why)
For each service pick relational or MongoDB, mapping the decision to specific
quality attributes. Ensure the overall set includes **both** kinds. Record a
one-line justification per service for the write-up.

### 3a. Relational services → UML class-diagram spec
For each relational service, model its entities from the codebase (ORM
models/entities, migrations, `schema.sql`, DDL) and write a UML spec. Read
`references/uml-class-spec.md` for the schema; in short, per diagram provide
`classes` (each with `attributes` carrying `type` and optional `key` = `PK`/`FK`/`UK`,
and a `tier` for layout) and `relationships` (`association` / `aggregation` /
`composition` / `generalization` / `dependency`, with `fromMult`/`toMult`).

Render:
```bash
python scripts/generate_uml.py uml-spec.json -o uml-diagrams          # SVG
python scripts/generate_uml.py uml-spec.json -o uml-diagrams --png    # + PNG (needs cairosvg)
```

### 3b. MongoDB service → JSON schema per collection
For the document service, identify the **key collections** and model each as a
MongoDB `$jsonSchema` validator, deciding what to **embed** vs **reference**.
Read `references/data-modeling-guide.md` (document-modelling section) and use
`assets/mongo-schema-template.json` as the skeleton. Write one file, e.g.
`<service>-collections.schema.json`, following `assets/example-mongo-schema.json`.
Validate it:
```bash
python scripts/validate_mongo_schema.py <service>-collections.schema.json
```

### 4. Write the report
Use `assets/report-template.md`. For each service: state the storage choice and
its quality-attribute justification; for relational services embed the class
diagram and explain the entities/keys/relationships; for the MongoDB service show
the collection schemas and explain the embedding/referencing decisions. English.

### 5. Present
Deliver the diagrams, the schema JSON files, and the report. Note anything
inferred vs. read from the repo so it can be corrected and re-rendered.

## Tips
- **Conceptual vs. physical.** For a *conceptual* class diagram keep types domain-level (`Money`, `UUID`, `OrderStatus`) and mark keys with `{PK}`/`{FK}`/`{UK}`; you don't need every physical column. The requirement's "UML conceptual class diagram or EER" is satisfied by this class-diagram form.
- **Relationship direction matters** (documented in the spec): for `composition`/`aggregation` the diamond sits on the **`from`** end (the whole); for `generalization`, `from` is the subclass and `to` the superclass (triangle on the parent).
- **Multiplicities** go in `fromMult`/`toMult` (`1`, `0..1`, `1..*`, `*`).
- **MongoDB**: embed data read together and owned by the document; reference across aggregate/service boundaries (store the other service's id as a string). Add `indexes` for the main access patterns.
- Keep each class diagram to a handful of entities per service; if it sprawls, the service boundary may be too wide.
