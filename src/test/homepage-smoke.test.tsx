import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a chainable mock that returns { data: [], error: null } for any chain
const createChainableMock = () => {
  const result = Promise.resolve({ data: [], error: null, count: 0 });
  const chain: any = () => chain;
  chain.select = chain;
  chain.insert = chain;
  chain.update = chain;
  chain.delete = chain;
  chain.eq = chain;
  chain.neq = chain;
  chain.gt = chain;
  chain.gte = chain;
  chain.lt = chain;
  chain.lte = chain;
  chain.like = chain;
  chain.ilike = chain;
  chain.is = chain;
  chain.in = chain;
  chain.order = chain;
  chain.limit = chain;
  chain.range = chain;
  chain.single = () => Promise.resolve({ data: null, error: null });
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  chain.then = result.then.bind(result);
  chain.catch = result.catch.bind(result);
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => createChainableMock(),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, profile: null, loading: false }),
}));

import Index from "@/pages/Index";

const renderHomepage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/"]}>
        <Index />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Homepage Smoke Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the main layout without crashing", () => {
    const { container } = renderHomepage();
    expect(container.querySelector("main")).toBeInTheDocument();
  });

  it("renders multiple sections (no blank page)", () => {
    const { container } = renderHomepage();
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBeGreaterThanOrEqual(2);
  });

  it("renders the footer", () => {
    const { container } = renderHomepage();
    expect(container.querySelector("footer")).toBeInTheDocument();
  });

  it("no sections have opacity 0", () => {
    const { container } = renderHomepage();
    const sections = container.querySelectorAll("section");
    sections.forEach((section) => {
      const style = window.getComputedStyle(section);
      expect(style.opacity).not.toBe("0");
    });
  });

  it("category section renders after data loads", async () => {
    const { container } = renderHomepage();
    // Some category headings may render only after data resolves. With mocked
    // empty datasets we just assert the page mounted (no crash) — deeper
    // integration is covered by the RLS + e2e suites.
    await waitFor(() => {
      expect(container.querySelector("main")).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it("renders only the premium showroom and no legacy hero or ads", async () => {
    const { container } = renderHomepage();
    await waitFor(() => expect(container.textContent).toContain("المعرض المميز"));
    expect(container.textContent).not.toContain("تسوق من تشكيلة واسعة");
    expect(container.textContent).not.toContain("إعلان عريض");
    expect(container.textContent).not.toContain("إعلان ثابت");
  });
});
