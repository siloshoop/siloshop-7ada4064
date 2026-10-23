import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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