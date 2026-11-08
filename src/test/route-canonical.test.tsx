import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RouteCanonical, { canonicalFor } from "@/components/RouteCanonical";
import NotFound from "@/pages/NotFound";

describe("per-page canonical address", () => {
  it("always points at www.siloshop.net without query or trailing slash", () => {
    expect(canonicalFor("/")).toBe("https://www.siloshop.net/");
    expect(canonicalFor("/store/abc/")).toBe("https://www.siloshop.net/store/abc");
    expect(canonicalFor("/category/phones")).toBe("https://www.siloshop.net/category/phones");
  });

  it("replaces the homepage canonical baked into index.html with the current page", () => {
    document.head.innerHTML = '<link rel="canonical" href="https://www.siloshop.net/" />';
    render(
      <MemoryRouter initialEntries={["/category/phones?sort=price"]}>
        <RouteCanonical />
      </MemoryRouter>,
    );
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://www.siloshop.net/category/phones",
    );
  });

  it("missing pages ask search engines not to index them", () => {
    document.head.innerHTML = "";
    const { unmount } = render(
      <MemoryRouter initialEntries={["/nope"]}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
