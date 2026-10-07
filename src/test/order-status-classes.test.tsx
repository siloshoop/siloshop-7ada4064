import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import { ORDER_STEPS, statusClasses } from "@/lib/orderStatus";

describe("order timeline colours", () => {
  it("uses literal compiled classes for every status", () => {
    for (const s of ORDER_STEPS) expect(statusClasses(s.key).bg).toMatch(/^bg-\[hsl\(var\(--status-[a-z]+\)\)\]$/);
  });
  it("keeps every previous step filled across each transition", () => {
    ORDER_STEPS.forEach((step, i) => {
      const { container, unmount } = render(<OrderStatusTimeline status={step.key} />);
      expect(container.querySelectorAll(".lucide-check")).toHaveLength(i);
      unmount();
    });
  });
});
