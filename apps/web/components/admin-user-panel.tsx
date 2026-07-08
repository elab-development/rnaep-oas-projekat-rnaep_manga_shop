"use client";

import type { Role, UserView } from "@workspace/contracts";
import { Roles } from "@workspace/contracts";
import { useCallback, useEffect, useState } from "react";
import { AdminError, changeRole, listUsers } from "@/lib/admin";

const ROLE_OPTIONS: Role[] = [Roles.Customer, Roles.Moderator, Roles.Admin];

/**
 * The admin user panel (issue 06): lists every account and lets an admin set
 * each user's single role (ADR-0005). Role gating to reach this panel is
 * client-side UX only — the Auth service re-verifies the JWT and enforces
 * `@Roles('admin')` on every call (ADR-0007), so this never carries the security
 * decision. All writes go through the gateway with the admin's token (ADR-0011).
 */
export function AdminUserPanel({ selfId }: { selfId: string }) {
  const [users, setUsers] = useState<UserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setUsers(await listUsers());
    } catch (err) {
      setLoadError(
        err instanceof AdminError
          ? err.message
          : "Could not load users. Is the shop running?",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load once on mount; refresh() owns its own loading/error state, so the
    // setState it triggers here is the intended data-fetch sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const onRoleChanged = useCallback((updated: UserView) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updated.id ? updated : u)),
    );
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground font-mono text-sm">
        {loading
          ? "Loading…"
          : `${users.length} account${users.length === 1 ? "" : "s"}`}
      </p>

      {loadError && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {loadError}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            isSelf={user.id === selfId}
            onChanged={onRoleChanged}
          />
        ))}
      </ul>
    </div>
  );
}

/** One account row: identity + a role selector that persists on change. */
function UserRow({
  user,
  isSelf,
  onChanged,
}: {
  user: UserView;
  isSelf: boolean;
  onChanged: (updated: UserView) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setRole(role: Role): Promise<void> {
    if (role === user.role) return;
    setBusy(true);
    setError(null);
    try {
      onChanged(await changeRole(user.id, role));
    } catch (err) {
      setError(err instanceof AdminError ? err.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="brutal-box bg-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-bold tracking-tight">
          {user.email}
          {isSelf && (
            <span className="text-muted-foreground font-mono text-[0.65rem] font-bold uppercase">
              (you)
            </span>
          )}
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          joined {new Date(user.createdAt).toLocaleDateString()}
        </p>
        {error && (
          <p role="alert" className="text-destructive mt-1 text-xs font-medium">
            {error}
          </p>
        )}
      </div>

      <label className="flex shrink-0 flex-col gap-1">
        <span className="font-mono text-[0.65rem] font-bold uppercase">
          Role
        </span>
        <select
          value={user.role}
          disabled={busy}
          onChange={(e) => setRole(e.target.value as Role)}
          aria-label={`Role for ${user.email}`}
          className="brutal-box bg-background h-9 px-2 font-mono text-sm font-bold uppercase disabled:opacity-50"
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
    </li>
  );
}
