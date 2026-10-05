import { describe, it, expect, vi, beforeEach } from "vitest";
const { signUp } = vi.hoisted(() => ({ signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signUp } } }));
import { signUp as doSignUp } from "@/lib/auth";
import { readFileSync } from "fs";

describe("auth email links", () => {
  beforeEach(() => signUp.mockClear());
  it("sign-up confirmation uses production URL even on localhost", async () => {
    await doSignUp("a@b.com", "Passw0rd!x", "Test");
    const url = signUp.mock.calls[0][0].options.emailRedirectTo;
    expect(url).toBe("https://www.siloshop.net/");
  });
  it("no auth file builds redirects from window.location", () => {
    for (const f of ["src/lib/auth.ts", "src/pages/ForgotPassword.tsx", "src/pages/VerifyEmail.tsx", "src/pages/Auth.tsx", "src/pages/ResetPassword.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(/(redirectTo|emailRedirectTo)[^\n]*window\.location/);
      expect(src).not.toMatch(/localhost|127\.0\.0\.1/);
    }
    expect(readFileSync("src/pages/ForgotPassword.tsx", "utf8")).toContain("${PRODUCTION_ORIGIN}/reset-password");
  });
});
