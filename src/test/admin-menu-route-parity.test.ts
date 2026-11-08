import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ADMIN_MODULES, canAccessAdminModule } from "@/components/admin/adminModules";

const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
const routeRole = (href: string) => {
  const match = app.match(new RegExp(`path="${href.replace(/[/]/g, "\\/")}" element={<RequireRole role=(\\{[^}]+\\}|"[^"]+")`));
  return match?.[1] ?? null;
};

describe("admin menu matches route permissions", () => {
  it("regular admins never see a menu entry whose page is owner-only", () => {
    for (const m of ADMIN_MODULES) {
      if (routeRole(m.href) === '"super_admin"') {
        expect(canAccessAdminModule(m.href, "admin"), m.href).toBe(false);
        expect(canAccessAdminModule(m.href, "super_admin"), m.href).toBe(true);
      }
    }
  });

  it("console home, orders, payments, reports, statistics, revenue and coupons are owner-only in the menu", () => {
    for (const href of ["/admin", "/admin/orders", "/admin/payments", "/admin/reports", "/admin/statistics", "/admin/revenue", "/admin/coupons"]) {
      expect(canAccessAdminModule(href, "admin")).toBe(false);
      expect(canAccessAdminModule(href, "super_admin")).toBe(true);
    }
  });

  it("regular admins keep their operational modules", () => {
    for (const href of ["/admin/brands", "/admin/chats", "/admin/notifications", "/admin/inventory", "/admin/audit", "/admin/settings"]) {
      expect(canAccessAdminModule(href, "admin")).toBe(true);
    }
  });
});
