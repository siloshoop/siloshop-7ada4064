import { describe, expect, it, vi } from "vitest";
import { resolveStaffRole } from "@/lib/staffRole";
describe("existing staff RBAC resolution", () => {
  it("resolves super_admin first without calling the internal audit helper", async () => {
    const lookup = vi.fn(async () => ({ data: true, error: null }));
    expect(await resolveStaffRole(lookup)).toBe("super_admin");
    expect(lookup.mock.calls).toEqual([["super_admin"]]);
  });
  it("keeps moderator permissions separate from admin", async () => {
    expect(await resolveStaffRole(async (role) => ({ data: role === "moderator", error: null }))).toBe("moderator");
  });
  it("rejects failed authorization queries rather than silently treating them as no role", async () => {
    await expect(resolveStaffRole(async () => ({ data: null, error: new Error("permission denied") }))).rejects.toThrow("permission denied");
  });
  it("returns no staff privileges for buyers or sellers", async () => {
    expect(await resolveStaffRole(async () => ({ data: false, error: null }))).toBeNull();
  });
});