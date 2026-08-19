import { supabase } from "@/integrations/supabase/client";

export type EmailStatus = "registered" | "not_registered" | "rate_limited" | "invalid" | "unknown";

export interface EmailCheckResult {
  status: EmailStatus;
  confirmed?: boolean;
  messageAr: string;
}

const MESSAGES: Record<EmailStatus, string> = {
  registered: "هذا البريد مسجّل لدينا",
  not_registered: "لا يوجد حساب مرتبط بهذا البريد الإلكتروني",
  rate_limited: "عدد كبير من المحاولات على هذا البريد، انتظر قليلاً ثم أعد المحاولة",
  invalid: "صيغة البريد الإلكتروني غير صحيحة",
  unknown: "تعذّر التحقق من البريد الإلكتروني حالياً",
};

/** Checks (via a rate-limited secure function) whether an email has an account. */
export const checkEmail = async (email: string): Promise<EmailCheckResult> => {
  try {
    const { data, error } = await supabase.rpc("check_email_registered", { p_email: email });
    if (error) throw error;
    const payload = (data ?? {}) as { status?: EmailStatus; confirmed?: boolean };
    const status: EmailStatus = payload.status ?? "unknown";
    const confirmed = payload.confirmed;
    let messageAr = MESSAGES[status] ?? MESSAGES.unknown;
    if (status === "registered") {
      messageAr = confirmed
        ? "هذا البريد مسجّل ومفعّل، يمكنك تسجيل الدخول"
        : "هذا البريد مسجّل لكن غير مفعّل، سنرسل لك رمز تحقق";
    }
    return { status, confirmed, messageAr };
  } catch {
    return { status: "unknown", messageAr: MESSAGES.unknown };
  }
};

/* ---------- Client-side login attempt throttling ---------- */

const KEY = "siloshop_login_attempts";
export const CAPTCHA_AFTER = 3;
const MAX_ATTEMPTS = 6;
const LOCK_SECONDS = 120;

interface AttemptState {
  count: number;
  lockedUntil: number;
}

const read = (): AttemptState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw) as AttemptState;
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
};

const write = (state: AttemptState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
};

export const getAttemptState = () => {
  const state = read();
  const remainingLock = Math.max(0, Math.ceil((state.lockedUntil - Date.now()) / 1000));
  if (remainingLock === 0 && state.lockedUntil > 0) {
    write({ count: 0, lockedUntil: 0 });
    return { count: 0, remainingLock: 0, needsCaptcha: false };
  }
  return {
    count: state.count,
    remainingLock,
    needsCaptcha: state.count >= CAPTCHA_AFTER,
  };
};

export const recordFailedAttempt = () => {
  const state = read();
  const count = state.count + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? Date.now() + LOCK_SECONDS * 1000 : 0;
  write({ count: lockedUntil ? 0 : count, lockedUntil });
  return {
    count,
    needsCaptcha: count >= CAPTCHA_AFTER,
    lockedSeconds: lockedUntil ? LOCK_SECONDS : 0,
  };
};

export const clearAttempts = () => write({ count: 0, lockedUntil: 0 });

/** Simple arithmetic challenge used as a lightweight CAPTCHA. */
export const makeChallenge = () => {
  const a = Math.floor(Math.random() * 9) + 2;
  const b = Math.floor(Math.random() * 9) + 2;
  return { question: `${a} + ${b}`, answer: String(a + b) };
};
