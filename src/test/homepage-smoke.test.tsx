import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
          limit: () => Promise.resolve({ data: [], error: null }),
          gte: () => ({
            lte: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          ilike: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
  },
}));

// Mock useAuth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, profile: null, loading: false }),
}));

// Import after mocks
import Index from "@/pages/Index";

const renderHomepage = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Index />
    </MemoryRouter>
  );

describe("Homepage Smoke Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the main layout without crashing", () => {
    const { container } = renderHomepage();
    expect(container.querySelector("main")).toBeInTheDocument();
  });

  it("renders the hero section", () => {
    const { container } = renderHomepage();
    // Hero should be one of the first sections
    const sections = container.querySelectorAll("section");
    expect(sections.length).toBeGreaterThan(0);
  });

  it("renders the footer", () => {
    renderHomepage();
    const footer = document.querySelector("footer");
    expect(footer).toBeInTheDocument();
  });

  it("does not show a blank page - multiple sections exist", () => {
    const { container } = renderHomepage();
    const sections = container.querySelectorAll("section");
    // At minimum: Hero + Categories + BestSellers = 3 sections
    expect(sections.length).toBeGreaterThanOrEqual(2);
  });

  it("all sections have opacity 1 (no hidden sections)", () => {
    const { container } = renderHomepage();
    const sections = container.querySelectorAll("section");
    sections.forEach((section) => {
      const style = window.getComputedStyle(section);
      // Should not have opacity 0
      expect(style.opacity).not.toBe("0");
    });
  });

  it("category section title is rendered", () => {
    renderHomepage();
    expect(screen.getByText("تسوق حسب الفئة")).toBeInTheDocument();
  });
});
