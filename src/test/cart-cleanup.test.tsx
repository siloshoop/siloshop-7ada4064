import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
import { removeUnavailableCartRows } from "@/lib/cartStock";
import { useCartCount } from "@/hooks/useCartCount";
import { notifySync } from "@/lib/uiSync";

type Row = { id: string; user_id: string; quantity: number; product: { stock_quantity: number } | null };
let saved: Row[];
let denied: boolean;
let fail: boolean;
const row = (id: string, stock: number, user_id = "buyer"): Row => ({ id, user_id, quantity: 1, product: { stock_quantity: stock } });

beforeEach(() => {
  vi.clearAllMocks();
  saved = [row("sold-out", 0), row("available", 3), row("other-user", 0, "other")];
  denied = false;
  fail = false;
  from.mockImplementation(() => {
    let deleting = false;
    let uid: string;
    let ids: string[] = [];
    const execute = () => {
      if (!deleting) return { data: saved.filter(r => r.user_id === uid), error: null };
      if (fail) return { data: null, error: new Error("offline") };
      const removed = denied ? [] : saved.filter(r => r.user_id === uid && ids.includes(r.id));
      saved = saved.filter(r => !removed.includes(r));
      return { data: removed.map(r => ({ id: r.id })), error: null };
    };
    const chain = {
      delete: () => { deleting = true; return chain; },
      select: () => deleting ? Promise.resolve(execute()) : chain,
      eq: (_key: string, value: string) => { uid = value; return chain; },
      in: (_key: string, values: string[]) => { ids = values; return chain; },
      then: (resolve: (value: ReturnType<typeof execute>) => void) => Promise.resolve(execute()).then(resolve),
    };
    return chain;
  });
});
afterEach(cleanup);

describe("saved cart stock cleanup", () => {
  it("deletes zero-stock rows, preserves stocked rows and other users, and stays silent on refetch", async () => {
    const result = await removeUnavailableCartRows("buyer", saved.filter(r => r.user_id === "buyer"));
    expect(result.removedCount).toBe(1);
    expect(result.rows.map(r => r.id)).toEqual(["available"]);
    expect(saved.map(r => r.id)).toEqual(["available", "other-user"]);
    expect((await removeUnavailableCartRows("buyer", result.rows)).removedCount).toBe(0);
    expect(from).toHaveBeenCalledTimes(1);
  });
  it("removes missing/inactive selected variants represented by zero effective stock", async () => {
    saved = [row("inactive-variant", 0), row("missing-variant", 0)];
    expect((await removeUnavailableCartRows("buyer", saved)).removedCount).toBe(2);
    expect(saved).toEqual([]);
  });
  it("keeps rows visible when deletion fails", async () => {
    fail = true;
    const result = await removeUnavailableCartRows("buyer", saved);
    expect(result.rows).toEqual(saved);
    expect(result.removedCount).toBe(0);
    expect(result.error).toBeInstanceOf(Error);
  });
  it("does not claim removal when RLS returns no deleted IDs", async () => {
    denied = true;
    const result = await removeUnavailableCartRows("buyer", saved);
    expect(result.rows).toEqual(saved);
    expect(result.removedCount).toBe(0);
  });
  it("syncs the badge from saved quantities after cleanup", async () => {
    const { result } = renderHook(() => useCartCount("buyer"));
    await waitFor(() => expect(result.current.count).toBe(2));
    await act(async () => {
      await removeUnavailableCartRows("buyer", saved.filter(r => r.user_id === "buyer"));
      notifySync("cart");
    });
    await waitFor(() => expect(result.current.count).toBe(1));
  });
});