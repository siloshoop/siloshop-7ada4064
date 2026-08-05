const PUSH_WORKER_PATH = "/push-notifications-sw.js";
const PUSH_SCOPE = "/push-notifications/";

export const getPushWorkerRegistration = async () => {
  if (!("serviceWorker" in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration(PUSH_SCOPE);
  return existing ?? navigator.serviceWorker.register(PUSH_WORKER_PATH, { scope: PUSH_SCOPE });
};