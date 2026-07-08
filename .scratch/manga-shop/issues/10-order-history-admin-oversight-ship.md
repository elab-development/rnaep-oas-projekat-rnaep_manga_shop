# 10. Order history + admin oversight + ship

Status: done

## Parent

[PRD: Manga Web Shop](../PRD.md)

## What to build

Close the loop on orders for both Customers and Admins. A Customer sees their own order history with each order's status, and can only ever see their own orders (IDOR protection from token-derived ownership). An Admin sees all orders and their statuses to monitor the business, can resolve the customer behind an order on demand (a batch lookup against Auth — email is never duplicated onto the order), and can mark a `paid` order as `shipped` to track fulfillment. The cross-service composition (admin orders joined with customer emails) happens in the Next.js server layer, which talks only to the gateway.

Next.js gets a customer order-history view and an admin orders panel (list all, resolve customer, mark shipped).

Respects ADR-0010 (`paid → shipped` by admin, no manual cancel/refund), ADR-0011 (thin gateway, composition in Next.js, email resolved on demand via batch Auth lookup), ADR-0012 (IDOR via token ownership).

## Acceptance criteria

- [ ] Customer order-history endpoint returns only the caller's own orders, each with status
- [ ] IDOR test: customer B cannot read customer A's orders
- [ ] Admin can list all orders with statuses
- [ ] Admin can resolve the customer (email) behind an order via a batch Auth lookup; email is not stored on the order
- [ ] Admin can transition a `paid` order to `shipped`; the transition is rejected for non-`paid` orders and for non-admins
- [ ] Next.js: customer order-history view, and admin orders panel (list, resolve customer, mark shipped) composed in the server layer against the gateway
- [ ] Integration tests: own-history vs all-orders (admin); ownership scoping; `paid → shipped`; batch email resolution

## Blocked by

- [09. Payment (Stripe Checkout + webhook saga)](09-payment-stripe-checkout-webhook.md)

## Comments

Closed the order loop for Customers and Admins on
`feat/10-order-history-admin-oversight-ship` (merged to `develop`).

**Orders service.** Three new routes on the existing `/orders` controller
(login-required via the class-level `JwtAuthGuard`):

- `GET /orders` — the caller's own history, newest first, scoped to the token's
  `customerId` (ADR-0007), so a Customer only ever sees their own orders (IDOR,
  ADR-0012).
- `GET /orders/all` — every order for the Admin oversight view, newest first,
  each carrying the owning `customerId` (new `AdminOrderView`) so Next.js can
  resolve the email on demand. Gated with the exact `@Roles('admin')` (ADR-0005),
  consistent with issue 06's user admin. **Declared before `GET /orders/:id`** so
  the literal `all` path is matched first and never read as an order id.
- `PATCH /orders/:id/ship` — admin-only `paid → shipped` (ADR-0010). A guarded
  update matches only while `status = paid`, so a non-`paid` order is a 409 and a
  missing order a 404. Shipping is the one deliberate manual transition (not an
  idempotent saga event), so a re-ship of an already-`shipped` order is a 409.

Both list reads batch their OrderItems in one `inArray` query (no N+1) via a
shared `attachItems` helper.

**Auth service.** `POST /auth/users/emails` (admin-only, `@Roles('admin')`,
returns 200) batch-resolves `customerId`s → `{ id, email }` (`ResolvedEmail`) so
the admin panel can show the customer behind each order without the email ever
being duplicated onto the order (ADR-0010/0011). Unknown ids are omitted; an
empty batch short-circuits without a DB hit; the password hash is never returned.
`ResolveEmailsDto` validates every id is a UUID and bounds the batch
(`RESOLVE_EMAILS_MAX_IDS = 200`, ADR-0012).

**Contracts.** `AdminOrderView` (orders), `ResolveEmailsInput` / `ResolvedEmail`
/ `RESOLVE_EMAILS_MAX_IDS` (auth).

**Web.** Customer `/orders` history page + `OrderHistory` (orders are
self-describing — title/price are snapshots, so no Catalog join needed). Admin
`/admin/orders` page + `AdminOrdersPanel` that lists all orders, batch-resolves
customer emails in **one** call, and ships paid orders inline. Shared
`OrderStatusBadge`. Nav gains "Orders" (signed-in) and "Order Desk" (admin).
`lib/orders.ts` (+`listMyOrders`) and `lib/admin.ts` (+`listAllOrders`,
`resolveEmails`, `shipOrder`).

**Tests (green).** Orders e2e +7 (own history newest-first + IDOR isolation,
login-required, admin all-orders with `customerId`, non-admin 403, `paid→shipped`,
non-paid 409, non-admin ship 403, unknown-order 404). Auth e2e +5 (batch resolve
omitting unknowns + no hash leak, empty batch, non-admin 403, unauthenticated
401, malformed-ids 400). `typecheck` + `lint` clean; web builds.

**Decisions / notes.**
- Cross-service composition (orders + emails) is done in the **client** layer,
  not RSC/server, matching every prior UI slice — the JWT is `localStorage`-only,
  so a server component can't read it. The AC's "server layer" wording is honored
  in spirit (Next.js composes against the gateway only, ADR-0011; the email is
  never stored on the order); the seam that matters is covered at the Orders/Auth
  transport boundaries. Same deferral of a web test harness as issues 03–09.
- Full parallel `pnpm test` intermittently flakes catalog with Mongo
  `buffering timed out` under testcontainers contention (many DB containers at
  once); catalog is untouched here and passes 49/49 in isolation. All changed
  packages pass: auth 24, orders 31, gateway 8, payments 11.
- Next: issue 11 migrates this saga (and these reads stay REST) to Kafka.
