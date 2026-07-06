import { BadGatewayException } from "@nestjs/common";
import type { OrderItemView } from "@workspace/contracts";
import { StripeService } from "../src/payments/stripe.service";

/**
 * Regression: a Stripe SDK failure (bad/missing STRIPE_SECRET_KEY, network, API
 * error) must surface as a **502**, never leaked raw. Stripe's own auth error
 * carries `statusCode: 401`, which — if passed through — reads to the browser as
 * "not signed in" and even echoes the API key. ADR-0008/0009: no Stripe fallback,
 * fail loudly, but as a clear gateway error.
 */
describe("StripeService.createCheckoutSession error handling", () => {
  const items: OrderItemView[] = [
    { mangaId: "m1", title: "Alpha Vol. 1", price: 1500, quantity: 1 },
  ];

  afterEach(() => jest.restoreAllMocks());

  it("translates a Stripe 401 auth error into a 502 (never a misleading 401)", async () => {
    const service = new StripeService();
    // Exactly the error a placeholder/invalid key produces, statusCode and all.
    const stripeError = Object.assign(
      new Error("Invalid API Key provided: sk_test_*ummy"),
      { statusCode: 401, type: "StripeAuthenticationError" },
    );
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn((service as any).stripe.checkout.sessions, "create")
      .mockRejectedValue(stripeError);

    await expect(
      service.createCheckoutSession({ orderId: "order-1", items }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it("fails loudly with a 502 when Stripe returns a session without a URL", async () => {
    const service = new StripeService();
    jest
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .spyOn((service as any).stripe.checkout.sessions, "create")
      .mockResolvedValue({ id: "cs_test_1", url: null });

    await expect(
      service.createCheckoutSession({ orderId: "order-1", items }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
