# 10. Order history + admin oversight + ship

Status: ready-for-agent

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
