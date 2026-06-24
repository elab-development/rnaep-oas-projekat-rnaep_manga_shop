/**
 * A user's single standing in the system (ADR-0005). One value, not a
 * collection; ordered as a hierarchy where each level includes the ones below.
 * `customer` is the default at registration.
 */
export const Roles = {
  Customer: "customer",
  Moderator: "moderator",
  Admin: "admin",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

/** Hierarchy rank: higher number includes the abilities of the lower ones. */
export const ROLE_RANK: Record<Role, number> = {
  customer: 0,
  moderator: 1,
  admin: 2,
};
