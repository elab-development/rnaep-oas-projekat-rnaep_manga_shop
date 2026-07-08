"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminOrderView } from "@workspace/contracts";
import { Button } from "@workspace/ui/components/button";
import {
  AdminError,
  listAllOrders,
  resolveEmails,
  shipOrder,
} from "@/lib/admin";
import { formatEur } from "@/lib/money";
import { OrderStatusBadge } from "@/components/order-status-badge";

/**
 * The admin order-oversight panel (issue 10): lists every order with its status,
 * resolves the customer behind each on demand, and marks a `paid` order
 * `shipped`. Cross-service composition (orders + customer emails) happens here in
 * the Next.js layer, which talks only to the gateway (ADR-0011). The email is
 * never stored on the order — it is batch-resolved from Auth (ADR-0010). Role
 * gating to reach this panel is client-side UX; every call is re-enforced
 * `@Roles('admin')` server-side (ADR-0005, ADR-0007).
 */
export function AdminOrdersPanel() {
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  // customerId → email, resolved in one batch alongside the orders.
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await listAllOrders();
      setOrders(all);
      // Resolve each distinct customer once, in a single batch call (ADR-0011).
      const ids = [...new Set(all.map((o) => o.customerId))];
      if (ids.length > 0) {
        const resolved = await resolveEmails(ids);
        setEmails(
          Object.fromEntries(resolved.map((u) => [u.id, u.email])),
        );
      }
    } catch (err) {
      setError(
        err instanceof AdminError
          ? err.message
          : "Could not load orders. Is the shop running?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const onShipped = useCallback((id: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "shipped" } : o)),
    );
  }, []);

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
      <div className="brutal-box bg-card p-8">
        <p className="text-lg font-bold">No orders yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground font-mono text-sm">
        {orders.length} order{orders.length === 1 ? "" : "s"}
      </p>
      <ul className="flex flex-col gap-4">
        {orders.map((order) => (
          <AdminOrderRow
            key={order.id}
            order={order}
            email={emails[order.customerId]}
            onShipped={onShipped}
          />
        ))}
      </ul>
    </div>
  );
}

/** One order row: status, customer, items, total, and a ship action when paid. */
function AdminOrderRow({
  order,
  email,
  onShipped,
}: {
  order: AdminOrderView;
  email: string | undefined;
  onShipped: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = order.items.reduce((n, i) => n + i.quantity, 0);

  async function ship(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await shipOrder(order.id);
      onShipped(order.id);
    } catch (err) {
      setError(err instanceof AdminError ? err.message : "Failed to ship.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="brutal-box bg-card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <OrderStatusBadge status={order.status} />
          <p className="text-muted-foreground font-mono text-xs">
            {new Date(order.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          {/* Customer resolved on demand from Auth; the email is not on the order. */}
          <p className="truncate font-bold tracking-tight">
            {email ?? "unknown customer"}
          </p>
          <p className="text-muted-foreground font-mono text-[0.65rem] tracking-wider uppercase">
            #{order.id.slice(0, 8)}
          </p>
        </div>
      </div>

      <div className="text-muted-foreground text-sm">
        <span className="font-medium">{order.shipping.recipientName}</span>
        {" · "}
        {order.shipping.address}, {order.shipping.city}{" "}
        {order.shipping.postalCode}
        {" · "}
        {order.shipping.phone}
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
              {item.title}
            </span>
            <span className="font-mono whitespace-nowrap">
              {formatEur(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="border-foreground/15 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <span className="text-muted-foreground font-mono text-xs uppercase">
          {count} item{count === 1 ? "" : "s"} ·{" "}
          <span className="text-foreground font-bold">
            {formatEur(order.total)}
          </span>
        </span>
        {/* A paid order is the only one an admin can ship (paid → shipped). */}
        {order.status === "paid" && (
          <Button
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => void ship()}
            className="brutal-btn px-3 font-mono text-xs font-bold tracking-wider uppercase"
          >
            {busy ? "Shipping…" : "Mark shipped"}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      )}
    </li>
  );
}
