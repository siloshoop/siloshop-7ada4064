export type StaffRole = "super_admin" | "admin" | "moderator";
type RoleLookup = (role: StaffRole) => PromiseLike<{ data: unknown; error: unknown }>;
/** Uses the existing callable RBAC checks; actor_admin_role is an internal audit helper. */
export async function resolveStaffRole(lookup: RoleLookup): Promise<StaffRole | null> {
  for (const role of ["super_admin", "admin", "moderator"] as const) {
    const { data, error } = await lookup(role);
    if (error) throw error;
    if (data === true) return role;
  }
  return null;
}