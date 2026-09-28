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

export const buildCompareShareUrl = (productIds: string[]): string => {
  const ids = productIds.filter(Boolean).join(",");
  return `${getPublicOrigin()}/compare${ids ? `?products=${ids}` : ""}`;
};
