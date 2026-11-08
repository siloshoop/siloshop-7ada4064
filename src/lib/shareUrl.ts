export const PRODUCTION_ORIGIN = "https://www.siloshop.net";

const LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

/** Public origin for share links — never localhost/local IPs (e.g. inside the Android app). */
export const getPublicOrigin = (): string => {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  const { protocol, hostname, origin } = window.location;
  if (protocol !== "https:" || LOCAL_HOST.test(hostname) || hostname.includes("lovable")) {
    return PRODUCTION_ORIGIN;
  }
  return origin;
};

/** Live store addresses visitors use directly; both are allowed auth return addresses. */
export const PRODUCTION_HOSTS = ["www.siloshop.net", "siloshop.net"] as const;

/**
 * Where auth emails (sign-up confirmation, password reset) send the visitor
 * back: the live address they are on, so a siloshop.net visitor stays on
 * siloshop.net; everywhere else (preview, local, Android app) the main address.
 */
export const getAuthRedirectOrigin = (): string => {
  if (typeof window === "undefined") return PRODUCTION_ORIGIN;
  const { protocol, hostname } = window.location;
  if (protocol === "https:" && (PRODUCTION_HOSTS as readonly string[]).includes(hostname)) {
    return `https://${hostname}`;
  }
  return PRODUCTION_ORIGIN;
};

export const buildCompareShareUrl = (productIds: string[]): string => {
  const ids = productIds.filter(Boolean).join(",");
  return `${getPublicOrigin()}/compare${ids ? `?products=${ids}` : ""}`;
};
