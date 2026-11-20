import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getPushWorkerRegistration } from "@/lib/pushWorker";

/**
 * Phone and browser push registration. Devices are saved through
 * register_push_device; public.notifications inserts trigger push-dispatch,
 * which sends through Firebase Cloud Messaging. No UI here.
 */

export type PushStatus =
  | "on"
  | "off"
  | "denied"
  | "unsupported"
  | "not-configured"
  | "open-in-new-tab";

export type PushResult = { status: PushStatus };

declare const __NATIVE_PUSH_READY__: boolean | undefined;

const TOKEN_KEY = "siloshop.pushToken";
const ASKED_KEY = "siloshop.pushAsked";
export const ANDROID_CHANNEL_ID = "siloshop_alerts";

const isNative = () => Capacitor.isNativePlatform();
const nativePlatform = () => (Capacitor.getPlatform() === "ios" ? "ios" : "android");

/** The Android build has Firebase only when google-services.json was present at build time; registering without it crashes the app. */
export const nativePushReady = () =>
  isNative() && typeof __NATIVE_PUSH_READY__ !== "undefined" && __NATIVE_PUSH_READY__ === true;

const webConfig = () => {
  const env = import.meta.env;
  const appId = env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
  return {
    apiKey: env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string | undefined,
    projectId: env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined,
    appId,
    messagingSenderId: appId?.split(":")[1] ?? "",
    vapidKey: env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined,
  };
};

export const webPushConfigured = () => {
  const c = webConfig();
  return !!(c.apiKey && c.projectId && c.appId && c.messagingSenderId && c.vapidKey);
};

const webPushSupported = () =>
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

const savedToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const saveToken = (token: string | null) => {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
};

const registerToken = async (token: string, platform: "android" | "ios" | "web") => {
  const { error } = await supabase.rpc("register_push_device", { _token: token, _platform: platform });
  if (error) throw error;
  saveToken(token);
};

// ---------- Native (Android / iOS app) ----------

let nativeListenersReady = false;
let pendingNative: ((token: string | null) => void) | null = null;
let openTarget: ((path: string) => void) | null = null;

/** Where a tapped phone notification should open (set by the router-aware registrar). */
export const setPushOpenHandler = (handler: ((path: string) => void) | null) => {
  openTarget = handler;
};

const safePath = (url: unknown) =>
  typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/notifications";

const ensureNativeListeners = async () => {
  if (nativeListenersReady) return;
  nativeListenersReady = true;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.addListener("registration", async ({ value }) => {
    try {
      await registerToken(value, nativePlatform());
      pendingNative?.(value);
    } catch (e) {
      console.error("push device save failed", e);
      pendingNative?.(null);
    }
    pendingNative = null;
  });
  await PushNotifications.addListener("registrationError", (err) => {
    console.error("push registration failed", err);
    pendingNative?.(null);
    pendingNative = null;
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const path = safePath((notification.data as Record<string, unknown> | undefined)?.url);
    if (openTarget) openTarget(path);
    else window.location.assign(path);
  });
};

const enableNative = async (prompt: boolean): Promise<PushResult> => {
  if (!nativePushReady()) return { status: "not-configured" };
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await ensureNativeListeners();
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    if (!prompt) return { status: "off" };
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return { status: "denied" };
  if (nativePlatform() === "android") {
    await PushNotifications.createChannel({
      id: ANDROID_CHANNEL_ID,
      name: "تنبيهات SiloShop",
      description: "الطلبات الجديدة وتحديثات الطلبات وطلبات المتاجر وإشعارات المنصة",
      importance: 4,
      visibility: 1,
      sound: "default",
      vibration: true,
    }).catch(() => undefined);
  }
  const token = await new Promise<string | null>((resolve) => {
    pendingNative = resolve;
    PushNotifications.register().catch(() => resolve(null));
    setTimeout(() => resolve(null), 15000);
  });
  return { status: token ? "on" : "off" };
};

// ---------- Web (browsers, installed web app) ----------

const enableWeb = async (prompt: boolean): Promise<PushResult> => {
  if (!webPushSupported()) return { status: "unsupported" };
  if (!webPushConfigured()) return { status: "not-configured" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };
  let permission = Notification.permission;
  if (permission === "default") {
    if (!prompt) return { status: "off" };
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return { status: "denied" };

  const c = webConfig();
  const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ]);
  if (!(await isSupported())) return { status: "unsupported" };
  const registration = await getPushWorkerRegistration();
  if (!registration) return { status: "unsupported" };
  const app = getApps()[0] ?? initializeApp({
    apiKey: c.apiKey, projectId: c.projectId, appId: c.appId, messagingSenderId: c.messagingSenderId,
  });
  const token = await getToken(getMessaging(app), { vapidKey: c.vapidKey, serviceWorkerRegistration: registration });
  if (!token) return { status: "off" };
  await registerToken(token, "web");
  return { status: "on" };
};

// ---------- Public API ----------

/** Turns notifications on for this device and signed-in account. Call from a tap when prompt is true. */
export const enablePush = (prompt = true): Promise<PushResult> =>
  (isNative() ? enableNative(prompt) : enableWeb(prompt)).catch((e) => {
    console.error("enablePush failed", e);
    return { status: "off" as const };
  });

/** Current state without prompting. */
export const pushStatus = async (): Promise<PushStatus> => {
  if (isNative()) {
    if (!nativePushReady()) return "not-configured";
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive === "denied") return "denied";
    return perm.receive === "granted" && savedToken() ? "on" : "off";
  }
  if (!webPushSupported()) return "unsupported";
  if (!webPushConfigured()) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && savedToken() ? "on" : "off";
};

/** Stops pushes to this device for the current account (e.g. on sign-out or when turned off). */
export const disablePush = async () => {
  const token = savedToken();
  saveToken(null);
  if (!token) return;
  await supabase.rpc("unregister_push_device", { _token: token }).then(undefined, () => undefined);
  if (!isNative() && webPushConfigured() && webPushSupported()) {
    try {
      const [{ getApps }, { getMessaging, deleteToken }] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
      const app = getApps()[0];
      if (app) await deleteToken(getMessaging(app));
    } catch { /* token already gone */ }
  }
};

/**
 * After sign-in: re-attach an already allowed device to this account and, in the
 * phone app, ask once per install. Browsers are only asked from a tap.
 */
export const syncPushAfterSignIn = async () => {
  if (isNative()) {
    if (!nativePushReady()) return;
    let asked = false;
    try { asked = localStorage.getItem(ASKED_KEY) === "1"; localStorage.setItem(ASKED_KEY, "1"); } catch { /* ignore */ }
    await enablePush(!asked);
    return;
  }
  if (webPushSupported() && webPushConfigured() && Notification.permission === "granted" && window.top === window.self) {
    await enablePush(false);
  }
};

export const pushStatusMessage = (status: PushStatus): { title: string; description: string } | null => {
  switch (status) {
    case "on":
      return { title: "تم تفعيل الإشعارات", description: "ستصلك تنبيهات الطلبات والتحديثات المهمة على هذا الجهاز" };
    case "denied":
      return {
        title: "الإشعارات محظورة",
        description: isNative()
          ? "اسمح بإشعارات SiloShop من إعدادات الهاتف ثم أعد المحاولة"
          : "اسمح بالإشعارات لهذا الموقع من إعدادات المتصفح ثم أعد المحاولة",
      };
    case "open-in-new-tab":
      return { title: "افتح الموقع في نافذة مستقلة", description: "لا يمكن تفعيل الإشعارات داخل المعاينة. افتح الموقع المنشور في تبويب جديد" };
    case "not-configured":
      return { title: "الإشعارات غير متاحة بعد", description: "خدمة الإشعارات قيد الإعداد، حاول لاحقًا" };
    case "unsupported":
      return { title: "غير مدعوم", description: "هذا المتصفح لا يدعم الإشعارات. على iPhone أضف الموقع إلى الشاشة الرئيسية أولًا" };
    default:
      return { title: "تعذّر تفعيل الإشعارات", description: "حاول مرة أخرى" };
  }
};
