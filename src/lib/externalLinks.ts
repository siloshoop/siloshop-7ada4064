import { Capacitor } from "@capacitor/core";

export const TELEGRAM_URL = "https://t.me/siloshoop";

/** Native same-window HTTPS navigation invokes Capacitor's OS app/browser handoff.
 * Browsers retain normal anchors, including modifier-click and new-tab behavior.
 * Keep HTTPS URLs: the browser is the fallback when the social app is absent.
 */
export const externalLinkTarget = (): "_self" | "_blank" =>
  Capacitor.isNativePlatform() ? "_self" : "_blank";