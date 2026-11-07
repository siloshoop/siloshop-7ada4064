import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import RequireRole from "@/components/RequireRole";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
afterEach(cleanup);

const Login = () => {
  const navigate = useNavigate();
  return <><span>Login screen</span><button onClick={() => navigate(-1)}>Back</button></>;
};

describe("signed-out protected navigation", () => {
  for (const role of ["customer", "vendor", "admin", "super_admin", "moderator"] as const) {
    it(`back skips the denied ${role} page rather than returning to login`, async () => {
      render(<MemoryRouter initialEntries={["/search", "/protected"]} initialIndex={1}>
        <Routes>
          <Route path="/search" element={<span>Previous search</span>} />
          <Route path="/protected" element={<RequireRole role={role}><span>Protected data</span></RequireRole>} />
          <Route path="/auth" element={<Login />} />
        </Routes>
      </MemoryRouter>);
      await screen.findByText("Login screen");
      fireEvent.click(screen.getByText("Back"));
      await waitFor(() => expect(screen.getByText("Previous search")).toBeTruthy());
      expect(screen.queryByText("Protected data")).toBeNull();
      expect(screen.queryByText("Login screen")).toBeNull();
    });
  }
});