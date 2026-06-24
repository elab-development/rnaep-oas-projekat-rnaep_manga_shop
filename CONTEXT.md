# Manga Web Shop

An online shop selling physical manga volumes. The domain is specified in Serbian (assignment, diagrams), but the project's ubiquitous language — code, database, events, and this glossary — is **English** (see ADR-0004).

## Actors

**Guest**:
An unauthenticated visitor. Can browse and search the catalog and register.
_Avoid_: anonymous, visitor.

**Customer**:
An authenticated user who places and tracks orders. The default role on registration.
_Avoid_: buyer, client, user (the term "user" is the auth-level account; a Customer is that account acting in the shop).

**Moderator**:
Manages the catalog and stock (add/edit manga, adjust stock).

**Admin**:
Manages users and roles and sees all orders; has all Moderator abilities too.

**Role**:
A user's single standing in the system, one of `customer | moderator | admin`, ordered as a hierarchy (each level includes the ones below). Authorization supports both a **hierarchical minimum** ("role ≥ required", so admin passes a moderator check) and an **exact / allow-list** check (a specific role must match, no inheritance) — see ADR-0005. A user has exactly one role; `customer` is the default at registration.
_Avoid_: permission set, role list (it is one value, not a collection).

## Catalog

**Manga**:
The central product — a physical manga volume with title, author, genres, price, cover, and stock. Lives in the Catalog service (MongoDB).

**Stock**:
The inventory state of a Manga, held as two numbers: `quantity` (physical copies on hand) and `reserved` (copies held for unpaid orders). **Available = `quantity − reserved`.**
_Avoid_: inventory (use "stock"), zalihe.

**Reservation**:
A hold placed on stock for a specific Order while it awaits payment. Tracked per-order so it can be committed or released for exactly the right quantity. Expires after 30 minutes (see ADR-0002).
_Avoid_: hold, lock.

**Price / Money**:
A monetary amount in **EUR**, stored as **integer cents**. EUR is the only settlement currency. USD/GBP/JPY are display-only conversions shown in the UI (cached Frankfurter rates) and never affect what is charged (see ADR-0006).
_Avoid_: storing money as a float/double; "base currency" (there is one currency for money — EUR; the others are just display labels).

## Ordering

**Cart**:
A Customer's working set of `CartItem`s before checkout. Owned by the Orders service.

**Order**:
A confirmed purchase created from a Cart, with `OrderItem`s and a total. Each OrderItem snapshots the manga title and per-unit price at order time, so later catalog changes don't alter past orders.
_Avoid_: purchase, transaction.

**Order status**:
`pending_payment` → `paid` (on the verified Stripe webhook) → `shipped` (set by an admin). `cancelled` happens only automatically — payment failure or the 30-min Stripe session expiry. There is no manual customer cancellation and no refund flow (see ADR-0010).

## Payment

**Payment**:
The record of charging a Customer for an Order via Stripe (test mode). Status: `pending` → `succeeded` / `failed`, or `refunded`. Owns the 30-minute payment/reservation clock (see ADR-0002).

## External systems

**Jikan**:
Open-source MyAnimeList API used to auto-fill manga data on creation.

**Frankfurter**:
Open-source currency API used to convert prices into other currencies.

**Stripe**:
Payment gateway (test mode). Not open-source; counts as a third integration, not one of the two required open-source APIs.
