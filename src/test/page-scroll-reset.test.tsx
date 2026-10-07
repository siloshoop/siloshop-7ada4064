import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
import PageScrollReset from "@/components/PageScrollReset";

const Controls = () => {
  const navigate = useNavigate();
  return <>
    <button onClick={() => navigate("/faq")}>Open</button>
    <button onClick={() => navigate(-1)}>Back</button>
    <button onClick={() => navigate("/?q=test")}>Search</button>
  </>;
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("page scroll reset", () => {
  it("starts at top on initial render, navigation, back and query changes", () => {
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<MemoryRouter><PageScrollReset /><Controls /></MemoryRouter>);
    expect(window.history.scrollRestoration).toBe("manual");
    expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
    for (const name of ["Open", "Back", "Search"]) {
      scroll.mockClear();
      fireEvent.click(screen.getByText(name));
      expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
    }
  });

  it("resets browser cache restores and cleans up on unmount", () => {
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    window.history.scrollRestoration = "auto";
    const { unmount } = render(<MemoryRouter><PageScrollReset /></MemoryRouter>);
    scroll.mockClear();
    fireEvent(window, new Event("pageshow"));
    expect(scroll).toHaveBeenCalledTimes(1);
    unmount();
    expect(window.history.scrollRestoration).toBe("auto");
    scroll.mockClear();
    fireEvent(window, new Event("pageshow"));
    expect(scroll).not.toHaveBeenCalled();
  });
});