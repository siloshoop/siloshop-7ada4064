import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import {
  readSignUpDraft, saveSignUpDraft, readSignUpSecret, saveSignUpSecret,
  clearSignUpDraft, getLastEmail, setLastEmail, setPendingVerifyEmail, getPendingVerifyEmail,
} from "@/lib/authDrafts";

const signOutMock = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: "u1", email: "Buyer@Example.com" } } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: () => {} } } })),
      signOut: () => signOutMock(),
    },
  },
}));

import { AuthProvider, useAuth } from "@/hooks/useAuth";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); signOutMock.mockClear(); });

describe("registration draft", () => {
  it("keeps non-secret fields in localStorage (survives app restart)", () => {
    saveSignUpDraft({ fullName: "A", email: "a@b.com", phoneCountry: "+963", phoneLocal: "944", acceptTerms: true });
    expect(readSignUpDraft()).toEqual({ fullName: "A", email: "a@b.com", phoneCountry: "+963", phoneLocal: "944", acceptTerms: true });
  });
  it("never writes the password to localStorage", () => {
    saveSignUpSecret("Secret!123", "Secret!123");
    expect(JSON.stringify({ ...localStorage })).not.toContain("Secret!123");
    expect(readSignUpSecret().password).toBe("Secret!123");
  });
  it("clears draft, password and pending email after verification", () => {
    saveSignUpDraft({ fullName: "A" }); saveSignUpSecret("x", "x"); setPendingVerifyEmail("a@b.com");
    clearSignUpDraft();
    expect(readSignUpDraft()).toEqual({});
    expect(readSignUpSecret()).toEqual({});
    expect(getPendingVerifyEmail()).toBe("");
  });
  it("normalises the remembered email", () => {
    setLastEmail("  Me@X.com ");
    expect(getLastEmail()).toBe("me@x.com");
  });
});

describe("logout", () => {
  it("remembers the email, ends only the session and stores no password", async () => {
    let api: ReturnType<typeof useAuth> | null = null;
    const Probe = () => { api = useAuth(); return null; };
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(api).not.toBeNull());
    await api!.signOut();
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(getLastEmail()).toBe("buyer@example.com");
    expect(Object.keys(localStorage).some((k) => /pass/i.test(k))).toBe(false);
  });
});
