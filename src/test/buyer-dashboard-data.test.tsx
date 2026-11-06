import { expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { reads, user, toast } = vi.hoisted(() => ({ reads: [] as { table: string; columns: string; userId?: string }[], user: { id: "buyer-test" }, toast: () => {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/UserStatistics", () => ({ default: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const read = { table, columns: "", userId: undefined as string | undefined };
    const result = { data: table === "profiles" ? { role: "customer" } : table === "orders" ? [{ status: "delivered" }] : [], count: 0 };
    const chain = {
      select: (columns: string) => { read.columns = columns; reads.push(read); return chain; },
      eq: (_key: string, value: string) => { read.userId = value; return chain; },
      in: () => chain, is: () => chain,
      single: async () => result, maybeSingle: async () => ({ data: null }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chain;
  },
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; },
  removeChannel: vi.fn(),
} }));
import Dashboard from "@/pages/Dashboard";

it("buyer summary fetches only own order statuses, not monetary data", async () => {
  reads.length = 0;
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  await waitFor(() => expect(reads.some((r) => r.table === "orders")).toBe(true));
  for (const read of reads.filter((r) => r.table === "orders")) {
    expect(read).toEqual({ table: "orders", columns: "status", userId: "buyer-test" });
  }
});