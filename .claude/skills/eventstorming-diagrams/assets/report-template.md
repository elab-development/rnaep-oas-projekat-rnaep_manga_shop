# EventStorming — {{APP_OR_DOMAIN}}

_Decomposition of user stories using the EventStorming methodology. Generated on {{DATE}}._

This document decomposes the user stories below into EventStorming boards: a
chronological sequence of domain events, the commands (system triggers) that
cause them, the business policies that make the flow reactive, and the aggregates
the behaviour groups into. One board is shown per user story.

**Legend.** Orange = Domain Event · Blue = Command · Pale yellow = Aggregate ·
Yellow = Actor · Purple = Policy · Green = Read Model · Pink = External System ·
Red = Hotspot.

---

## Story 1 — {{STORY_TITLE}}

> _As a {{role}}, I want to {{capability}} so that {{benefit}}._

![EventStorming board for Story 1](eventstorming/01-{{id}}.svg)

**Chronological event flow.** _Narrate the events left→right in past tense:
"First … happened, then …, then …". This is the backbone._

**Commands (triggers) and actors.** _For the key events, state the command that
caused them and who issued it._

**Policies.** _List the reactive rules and what they trigger: "When {{event}}, the
system {{does next command}}." Explain how they chain the steps together._

**Aggregates (grouping).** _Explain which steps group under which aggregate and
why — what each aggregate owns and why it is a sensible consistency boundary._
- **{{Aggregate A}}** — _steps/behaviour it owns._
- **{{Aggregate B}}** — _steps/behaviour it owns._

**Read models / external systems / hotspots.** _Note any information read before a
decision, external systems involved, and open questions to resolve._

---

## Story 2 — {{STORY_TITLE}}
_…same structure; embed `eventstorming/02-{{id}}.svg`…_

---

## Notes & assumptions
- _List anything inferred rather than stated in the user stories, so it can be corrected._
- _Boards are SVG (also available as PNG); regenerate with `scripts/generate_eventstorming.py`._
