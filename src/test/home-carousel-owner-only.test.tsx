import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const from = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => from(t) } }));

const liveAds = vi.fn();
vi.mock("@/lib/homeCarousel", async (orig) => {
  const real = await orig<typeof import("@/lib/homeCarousel")>();
  return {
    ...real,
    fetchLiveCarouselAds: () => liveAds(),
    fetchCarouselSettings: async () => real.DEFAULT_CAROUSEL_SETTINGS,
    trackCarouselEvent: () => true,
  };
});

import AnimatedProductCarousel from "@/components/home/AnimatedProductCarousel";
import { msUntilNextAdExpiry } from "@/lib/homeCarousel";

const ad = (id: string, title: string, end_date: string | null) => ({
  id, title, description: null, image_url: null, cta_url: "/", price: null, currency: null,
  priority: 0, is_active: true, start_date: null, end_date,
});

describe("homepage ads are owner-only and expire", () => {
  beforeEach(() => { from.mockReset(); liveAds.mockReset(); });
  afterEach(() => vi.useRealTimers());

  it("shows nothing (and never fills in products) when the owner has no live ad", async () => {
    liveAds.mockResolvedValue([]);
    const { container } = render(<MemoryRouter><AnimatedProductCarousel /></MemoryRouter>);
    await waitFor(() => expect(container.querySelector("section")).toBeNull());
    expect(from).not.toHaveBeenCalledWith("products");
  });

  it("removes an ad from the screen when its end date passes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const end = new Date(Date.now() + 60_000).toISOString();
    liveAds.mockResolvedValueOnce([ad("a1", "عرض ينتهي", end)]).mockResolvedValue([]);
    render(<MemoryRouter><AnimatedProductCarousel /></MemoryRouter>);
    await waitFor(() => expect(screen.getAllByText("عرض ينتهي").length).toBeGreaterThan(0));
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    await waitFor(() => expect(screen.queryByText("عرض ينتهي")).toBeNull());
  });

  it("times the next expiry from the soonest end date", () => {
    const now = Date.parse("2026-11-11T06:00:00Z");
    expect(msUntilNextAdExpiry([{ end_date: null }, { end_date: "2026-11-11T07:00:00Z" }, { end_date: "2026-11-11T06:30:00Z" }], now)).toBe(30 * 60_000);
    expect(msUntilNextAdExpiry([{ end_date: null }], now)).toBeNull();
    expect(msUntilNextAdExpiry([{ end_date: "2026-11-11T05:00:00Z" }], now)).toBe(0);
  });
});
