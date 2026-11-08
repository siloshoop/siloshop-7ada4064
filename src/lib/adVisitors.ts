export interface AdVisit {
  visited_at: string;
  is_guest: boolean;
  full_name: string | null;
  avatar_url: string | null;
  account_missing: boolean;
}

export interface AdVisitorsSummary {
  total_views: number;
  unique_visitors: number;
  signed_in_visitors: number;
  guest_visitors: number;
  untracked_views: number;
}

export interface AdVisitorsResult {
  summary: AdVisitorsSummary;
  visits: AdVisit[];
  has_more: boolean;
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

export function parseAdVisitors(raw: unknown): AdVisitorsResult {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const s = (obj.summary && typeof obj.summary === "object" ? obj.summary : {}) as Record<string, unknown>;
  const visits = Array.isArray(obj.visits) ? obj.visits : [];
  return {
    summary: {
      total_views: n(s.total_views),
      unique_visitors: n(s.unique_visitors),
      signed_in_visitors: n(s.signed_in_visitors),
      guest_visitors: n(s.guest_visitors),
      untracked_views: n(s.untracked_views),
    },
    visits: visits.map((v) => {
      const r = (v ?? {}) as Record<string, unknown>;
      return {
        visited_at: String(r.visited_at ?? ""),
        is_guest: r.is_guest !== false,
        full_name: str(r.full_name),
        avatar_url: str(r.avatar_url),
        account_missing: r.account_missing === true,
      };
    }),
    has_more: obj.has_more === true,
  };
}

/** Local calendar days (yyyy-mm-dd) → UTC bounds; the end day is included (exclusive next-day bound). */
export function localDayRange(from: string, to: string): { from: string | undefined; to: string | undefined } {
  const parse = (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const start = parse(from);
  const end = parse(to);
  if (end) end.setDate(end.getDate() + 1);
  return { from: start?.toISOString(), to: end?.toISOString() };
}
