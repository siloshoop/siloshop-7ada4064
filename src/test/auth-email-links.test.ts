import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const { signUp } = vi.hoisted(() => ({ signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signUp } } }));
import { signUp as doSignUp } from "@/lib/auth";
import authSrc from "@/lib/auth.ts?raw";
import forgotSrc from "@/pages/ForgotPassword.tsx?raw";
import verifySrc from "@/pages/VerifyEmail.tsx?raw";
import authPageSrc from "@/pages/Auth.tsx?raw";
import resetSrc from "@/pages/ResetPassword.tsx?raw";

describe("auth email links", () => {
  beforeEach(() => signUp.mockClear());
  it("sign-up confirmation uses production URL even on localhost", async () => {
    await doSignUp("a@b.com", "Passw0rd!x", "Test");
    const url = signUp.mock.calls[0][0].options.emailRedirectTo;
    expect(url).toBe("https://www.siloshop.net/");
  });
  it("no auth file builds redirects from window.location", () => {
    for (const src of [authSrc, forgotSrc, verifySrc, authPageSrc, resetSrc]) {
      expect(src).not.toMatch(/(redirectTo|emailRedirectTo)[^\n]*window\.location/);
      expect(src).not.toMatch(/localhost|127\.0\.0\.1/);
    }
    expect(forgotSrc).toContain("${getAuthRedirectOrigin()}/reset-password");
  });
});

describe("auth return address per visited address", () => {
  const setLocation = (href: string) => {
    const url = new URL(href);
    vi.stubGlobal("location", url);
    Object.defineProperty(window, "location", { value: url, configurable: true });
  };
  afterEach(() => vi.unstubAllGlobals());

  it("a siloshop.net visitor's reset/confirmation link returns to siloshop.net", async () => {
    setLocation("https://siloshop.net/forgot-password");
    const { getAuthRedirectOrigin } = await import("@/lib/shareUrl");
    expect(getAuthRedirectOrigin()).toBe("https://siloshop.net");
  });

  it("a www.siloshop.net visitor's link returns to www.siloshop.net", async () => {
    setLocation("https://www.siloshop.net/forgot-password");
    const { getAuthRedirectOrigin } = await import("@/lib/shareUrl");
    expect(getAuthRedirectOrigin()).toBe("https://www.siloshop.net");
  });

  it("preview and other addresses fall back to www.siloshop.net", async () => {
    const { getAuthRedirectOrigin } = await import("@/lib/shareUrl");
    for (const href of ["https://siloshop.lovable.app/auth", "https://localhost/auth", "http://siloshop.net/auth"]) {
      setLocation(href);
      expect(getAuthRedirectOrigin()).toBe("https://www.siloshop.net");
    }
  });
});
