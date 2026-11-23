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
