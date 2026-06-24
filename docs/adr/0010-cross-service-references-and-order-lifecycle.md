# Cross-service references by id only; orders are self-describing; lifecycle is mostly automatic

**No cross-database foreign keys.** IDs from other services (`customer_id`, `manga_id`) are stored as plain logical fields. Foreign keys exist only within a single service's own database.

**Orders are self-describing for fulfillment.** At checkout an Order snapshots the recipient/shipping details (name, address, city, postal code, phone) and each `OrderItem`'s manga title + EUR price. So viewing or shipping an order needs no call to another service. The one thing not stored is the customer's **account email**, which is resolved **on demand** via a batch lookup to Auth (resolve a set of `customer_id`s → emails) only when a view needs it. Account email is deliberately **not** duplicated onto orders — it can change, and copies go stale.

**Order lifecycle:**
- `pending_payment` → `paid` (on the verified Stripe webhook) → `shipped` (an **admin** marks a paid order shipped).
- `cancelled` happens **only automatically** — Stripe session expiry or payment failure → `payment-failed` → release hold → `cancelled`. There is no manual customer "cancel"; an unpaid order simply auto-releases at 30 min.

**No refund flow (refunds out of scope).** Because stock is reserved *before* payment, payment success can never fail to commit stock — so there is no automated "paid but undeliverable → refund" path. `refunded` stays in the payment enum as a reserved/future value, but no refund feature is built; any refund would be a manual admin action. No FZ requires one.
