import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("contains a real render crash and recovers when navigating away", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const Crash = () => { throw new Error("failed route"); };
  render(<MemoryRouter initialEntries={["/bad"]}><RouteErrorBoundary><Routes><Route path="/bad" element={<Crash />} /><Route path="/" element={<p>Working page</p>} /></Routes></RouteErrorBoundary></MemoryRouter>);
  expect(screen.getByRole("heading", {name:"تعذّر عرض الصفحة"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", {name:"الرئيسية"}));
  expect(await screen.findByText("Working page")).toBeInTheDocument();
});
it("preserves mounted page reads when filters replace the same-page URL", () => {
  const mounted = vi.fn();
  const Page = () => {
    const [params, setParams] = useSearchParams();
    useEffect(() => { mounted(); }, []);
    return <button onClick={() => setParams({ q: "phone" }, { replace: true })}>{params.get("q") || "Filter"}</button>;
  };
  render(<MemoryRouter initialEntries={["/search"]}><RouteErrorBoundary><Page /></RouteErrorBoundary></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Filter" }));
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "phone" })).toBeInTheDocument();
});