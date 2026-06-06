import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShoppingBag } from "lucide-react";
import { CategoryCardItem } from "@/components/CategoryCardItem";

const baseProps = {
  category: { id: "c1", name_ar: "هواتف", product_count: 12 },
  colors: { bg: "from-blue-500/15 to-cyan-500/15", icon: "text-blue-600", ring: "" },
  isExpanded: false,
  hasSubs: false,
  index: 0,
  IconComponent: ShoppingBag,
};

describe("CategoryCardItem (a11y + interaction)", () => {
  it("renders as a keyboard-focusable button with an accessible name", () => {
    render(<CategoryCardItem {...baseProps} onActivate={() => {}} />);
    const btn = screen.getByRole("button", { name: /هواتف/ });
    expect(btn).toHaveAttribute("tabIndex", "0");
  });

  it("activates on Enter and Space", () => {
    const onActivate = vi.fn();
    render(<CategoryCardItem {...baseProps} onActivate={onActivate} />);
    const btn = screen.getByRole("button", { name: /هواتف/ });
    btn.focus();
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.keyDown(btn, { key: " " });
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it("ignores unrelated keys", () => {
    const onActivate = vi.fn();
    render(<CategoryCardItem {...baseProps} onActivate={onActivate} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "a" });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("shows pressed state on pointer down and clears it shortly after", async () => {
    vi.useFakeTimers();
    render(<CategoryCardItem {...baseProps} onActivate={() => {}} />);
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn);
    expect(btn.getAttribute("data-pressed")).toBe("true");
    vi.advanceTimersByTime(250);
    expect(btn.getAttribute("data-pressed")).toBeNull();
    vi.useRealTimers();
  });

  it("clears pressed state if pointer leaves (prevents stuck/jitter)", () => {
    render(<CategoryCardItem {...baseProps} onActivate={() => {}} />);
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn);
    expect(btn.getAttribute("data-pressed")).toBe("true");
    fireEvent.pointerLeave(btn);
    expect(btn.getAttribute("data-pressed")).toBeNull();
  });

  it("exposes aria-expanded only when it has subcategories", () => {
    const { rerender } = render(
      <CategoryCardItem {...baseProps} hasSubs={false} onActivate={() => {}} />
    );
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-expanded");
    rerender(
      <CategoryCardItem {...baseProps} hasSubs={true} isExpanded={true} onActivate={() => {}} />
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });
});