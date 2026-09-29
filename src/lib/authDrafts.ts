// Device-local helpers so users never re-type sign-up data or their email.
// Passwords live only in sessionStorage (cleared when the app is killed).
const DRAFT_KEY = "siloshop_signup_draft";
const SECRET_KEY = "siloshop_signup_draft_secret";
const LAST_EMAIL_KEY = "siloshop_last_email";
const PENDING_VERIFY_KEY = "siloshop_pending_verify_email";

export interface SignUpDraft {
  fullName?: string;
  email?: string;
  phoneCountry?: string;
  phoneLocal?: string;
  acceptTerms?: boolean;
}

const safeGet = (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } };
const safeSet = (s: Storage, k: string, v: string) => { try { s.setItem(k, v); } catch { /* ignore */ } };
const safeDel = (s: Storage, k: string) => { try { s.removeItem(k); } catch { /* ignore */ } };

export const readSignUpDraft = (): SignUpDraft => {
  try { return JSON.parse(safeGet(localStorage, DRAFT_KEY) || "{}"); } catch { return {}; }
};
export const saveSignUpDraft = (d: SignUpDraft) => safeSet(localStorage, DRAFT_KEY, JSON.stringify(d));

export const readSignUpSecret = (): { password?: string; confirm?: string } => {
  try { return JSON.parse(safeGet(sessionStorage, SECRET_KEY) || "{}"); } catch { return {}; }
};
export const saveSignUpSecret = (password: string, confirm: string) =>
  safeSet(sessionStorage, SECRET_KEY, JSON.stringify({ password, confirm }));

export const clearSignUpDraft = () => {
  safeDel(localStorage, DRAFT_KEY);
  safeDel(sessionStorage, SECRET_KEY);
  safeDel(localStorage, PENDING_VERIFY_KEY);
};

export const getLastEmail = () => safeGet(localStorage, LAST_EMAIL_KEY) || "";
export const setLastEmail = (email: string) => {
  const e = email.trim().toLowerCase();
  if (e) safeSet(localStorage, LAST_EMAIL_KEY, e);
};

export const getPendingVerifyEmail = () => safeGet(localStorage, PENDING_VERIFY_KEY) || "";
export const setPendingVerifyEmail = (email: string) => safeSet(localStorage, PENDING_VERIFY_KEY, email.trim().toLowerCase());
