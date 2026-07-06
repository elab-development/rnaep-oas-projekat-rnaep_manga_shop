"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { OrderView } from "@workspace/contracts";
import { CheckoutError, listMyOrders } from "@/lib/orders";
import { formatEur } from "@/lib/money";
import { OrderStatusBadge } from "@/components/order-status-badge";

/**
 * The Customer's own order history (issue 10). Reads through the gateway with the
 * Customer's token; the Orders service scopes the result to the token's owner, so
 * only the caller's own orders ever appear (IDOR, ADR-0012). Each order is
 * self-describing — title and price are snapshotted onto the order at checkout
 * (ADR-0010) — so no Catalog join is needed here.
 */
export function OrderHistory() {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await listMyOrders());
    } catch (err) {
      setError(
        err instanceof CheckoutError
          ? err.message
          : "Could not load your orders. Is the shop running?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load once on mount; load() owns its own loading/error state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-muted-foreground font-mono text-sm">Loading…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-destructive text-sm font-medium">
        {error}
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="brutal-box bg-card flex flex-col items-start gap-2 p-8">
        <p className="text-lg font-bold">No orders yet.</p>
        <p className="text-muted-foreground">
          When you place an order it will show up here with its status.
        </p>
        <Link
          href="/catalog"
          className="mt-2 font-semibold underline underline-offset-4"
        >
          Browse the catalog
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </ul>
  );
}

/** One order: status, placed date, its line items, and the total. */
function OrderCard({ order }: { order: OrderView }) {
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <li className="brutal-box bg-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <OrderStatusBadge status={order.status} />
          <p className="text-muted-foreground font-mono text-xs">
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <p className="text-muted-foreground font-mono text-[0.65rem] tracking-wider uppercase">
          #{order.id.slice(0, 8)}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {order.items.map((item) => (
          <li
            key={item.mangaId}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground font-mono">
                {item.quantity}×
              </span>{" "}
              <Link
                href={`/catalog/${item.mangaId}`}
                className="font-medium hover:underline"
              >
                {item.title}
              </Link>
            </span>
            <span className="font-mono whitespace-nowrap">
              {formatEur(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-foreground/15 flex items-center justify-between border-t pt-3">
        <span className="text-muted-foreground font-mono text-xs uppercase">
          {count} item{count === 1 ? "" : "s"}
        </span>
        <span className="font-mono text-lg font-bold">
          {formatEur(order.total)}
        </span>
      </div>
    </li>
  );
}
