# Thin API Gateway; cross-service composition lives in the Next.js server layer

The API Gateway is a thin edge: it validates the JWT (fast-fail), applies the single CORS policy, and routes path → service. It does **not** compose or aggregate responses across services. Cross-service composition (e.g. the admin all-orders view = orders + batch-resolved customer emails from Auth) happens in the **Next.js server layer** (server components / server actions), which calls the gateway multiple times server-side and stitches the result.

**Why:** keeps the gateway dumb, stateless, and trivially scalable (NFR: 3 instances), and avoids coupling it to every service's response shape. Next.js server components already act as a BFF — they run server-side, fan out to the gateway over the internal network at low latency, and compose before responding to the browser — so we get "one call from the browser" without putting domain logic in the gateway. The spec's hard rule still holds: the frontend (including server components) talks only to the gateway, never to services directly.

**Rejected — aggregating/BFF gateway:** composed endpoints in the gateway would reduce browser round-trips, but server components already provide that benefit, and a composing gateway would have to know each domain's shape.
