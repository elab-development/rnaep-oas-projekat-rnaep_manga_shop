# English is the project's ubiquitous language

The assignment, and its diagrams (ER/PMOV, EventStorming, C4), are written in Serbian, with Serbian persistence fields (`narudzbina`, `kolicina`, `rezervisano`), Serbian Kafka topic names, and Serbian UI. We instead use **English everywhere in the project**: code identifiers, database columns, MongoDB fields, Kafka topic names, and the `CONTEXT.md` glossary. UI copy language is decided separately.

**Why:** One language end-to-end avoids a Serbian↔English translation seam — notably, MongoDB field names can't be aliased the way SQL columns can, so a "Serbian data / English code" hybrid would leak Serbian into code regardless. English is also the idiomatic choice for TypeScript/NestJS.

**Cost we accept:** the graded diagrams are in Serbian, so there's a doc↔code language mismatch unless the diagrams are redrawn in English for the final submission. We chose code consistency over matching the original Serbian deliverables, and will align the final-submission diagrams to the English terms.

The canonical term mapping lives in `CONTEXT.md`.
