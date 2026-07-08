# Prices are EUR integer-cents; other currencies are display-only

Each Manga's price is canonical in **EUR**, stored as **integer minor units (cents)** in MongoDB, the order snapshots, and the shared contracts. Orders total, snapshot, and the Stripe charge are all in EUR. Other currencies (**USD, GBP, JPY**) are shown in the UI as smaller informational labels beneath the EUR price, converted via cached Frankfurter rates — they never affect what is charged.

**Why integer cents:** floating-point money accumulates rounding errors (`0.1 + 0.2 ≠ 0.3`); the spec's `double` typing would be a correctness bug. Integers are the standard fix and cost nothing.

**Why display-only settlement:** charging in the customer's chosen currency would introduce rate drift between browse and checkout, refund mismatches when rates move, and Stripe per-currency rounding rules (e.g. JPY has no minor units). FZ-09 only asks the customer to *understand* the price, not pay in that currency. With display-only conversion, Frankfurter is a pure read-side convenience and its 12–24h rate cache is harmless because it never touches the charged amount.

**Display currencies are limited to what Frankfurter supports.** RSD was requested but the ECB (Frankfurter's source) doesn't publish it, and Frankfurter is one of the two required open-source APIs, so we kept USD/GBP/JPY rather than swap the provider.

See ADR-0002 for how the EUR snapshot is taken at order time.
