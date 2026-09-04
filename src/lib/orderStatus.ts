import {
  Clock, PackageCheck, Package, Boxes, Truck, Bike, Home, CheckCircle2, XCircle, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for the order lifecycle.
 * Mirrors the database functions `normalize_order_status`,
 * `is_valid_order_status` and `order_status_can_transition`.
 * The database remains authoritative — this layer only prevents
 * obviously invalid UI actions and renders consistent labels/colors.
 */
export type OrderStatus =
  | "pending" | "confirmed" | "preparing" | "ready_for_shipping" | "shipped"
  | "out_for_delivery" | "delivered" | "completed" | "cancelled" | "returned";

export type ActorRole = "system" | "buyer" | "seller" | "admin";

export interface OrderStatusMeta {
  key: OrderStatus;
  label: string;
  /** design-token name, see --status-* in index.css */
  token: string;
  icon: typeof Clock;
  /** part of the linear progress bar shown to customers */
  isStep: boolean;
}

export const ORDER_STATUSES: OrderStatusMeta[] = [
  { key: "pending", label: "قيد الانتظار", token: "--status-pending", icon: Clock, isStep: true },
  { key: "confirmed", label: "تم التأكيد", token: "--status-confirmed", icon: PackageCheck, isStep: true },
  { key: "preparing", label: "قيد التجهيز", token: "--status-preparing", icon: Package, isStep: true },
  { key: "ready_for_shipping", label: "جاهز للشحن", token: "--status-ready", icon: Boxes, isStep: true },
  { key: "shipped", label: "تم الشحن", token: "--status-shipped", icon: Truck, isStep: true },
  { key: "out_for_delivery", label: "تم تسليم الطلب إلى مركز الشحن", token: "--status-out", icon: Bike, isStep: true },
  { key: "delivered", label: "تم التوصيل", token: "--status-delivered", icon: Home, isStep: true },
  { key: "completed", label: "مكتمل", token: "--status-completed", icon: CheckCircle2, isStep: true },
  { key: "cancelled", label: "ملغي", token: "--status-cancelled", icon: XCircle, isStep: false },
  { key: "returned", label: "مرتجع", token: "--status-returned", icon: RotateCcw, isStep: false },
];

export const ORDER_STEPS = ORDER_STATUSES.filter((s) => s.isStep);

const BY_KEY = new Map(ORDER_STATUSES.map((s) => [s.key, s]));

/** Legacy value `processing` is stored as `preparing`. */
export const normalizeStatus = (status?: string | null): OrderStatus => {
  const s = (status || "").trim().toLowerCase();
  const mapped = s === "processing" ? "preparing" : s;
  return (BY_KEY.has(mapped as OrderStatus) ? mapped : "pending") as OrderStatus;
};

export const getStatusMeta = (status?: string | null): OrderStatusMeta =>
  BY_KEY.get(normalizeStatus(status))!;

export const statusLabel = (status?: string | null): string => getStatusMeta(status).label;

export const ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s.key, s.label]),
);

/** Tailwind classes driven by the semantic status tokens (no hardcoded colors). */
export const statusClasses = (status?: string | null) => {
  const t = getStatusMeta(status).token;
  return {
    text: `text-[hsl(var(${t}))]`,
    bg: `bg-[hsl(var(${t}))]`,
    softBg: `bg-[hsl(var(${t})/0.12)]`,
    border: `border-[hsl(var(${t})/0.4)]`,
    badge: `bg-[hsl(var(${t})/0.14)] text-[hsl(var(${t}))] border border-[hsl(var(${t})/0.4)]`,
  };
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready_for_shipping", "cancelled"],
  ready_for_shipping: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivered", "returned"],
  out_for_delivery: ["delivered", "returned"],
  delivered: ["completed", "returned"],
  completed: ["returned"],
  cancelled: [],
  returned: [],
};

export const canTransition = (from: string | null | undefined, to: OrderStatus, role: ActorRole): boolean => {
  const f = normalizeStatus(from);
  if (f === to) return false;
  if (!TRANSITIONS[f].includes(to)) return false;
  if (role === "buyer" && to !== "cancelled") return false;
  if (role === "seller" && (to === "completed" || to === "returned")) return false;
  return true;
};

export const allowedNextStatuses = (from: string | null | undefined, role: ActorRole): OrderStatusMeta[] =>
  ORDER_STATUSES.filter((s) => canTransition(from, s.key, role));

/* ------------------------------------------------------------------ */
/* Client context captured with every audited action                   */
/* ------------------------------------------------------------------ */

let cachedIp: string | null | undefined;

/** Best-effort public IP lookup, cached for the session. Never blocks for long. */
export const getClientIp = async (): Promise<string | null> => {
  if (cachedIp !== undefined) return cachedIp;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    clearTimeout(timer);
    const json = (await res.json()) as { ip?: string };
    cachedIp = json.ip || null;
  } catch {
    cachedIp = null;
  }
  return cachedIp;
};

export const getClientMeta = async () => ({
  ip: await getClientIp(),
  userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
});

/** Compact, human readable device description from a user-agent string. */
export const describeDevice = (ua?: string | null): string => {
  if (!ua) return "غير معروف";
  const os = /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Windows/i.test(ua) ? "Windows"
    : /Mac OS X/i.test(ua) ? "macOS"
    : /Linux/i.test(ua) ? "Linux" : "نظام آخر";
  const browser = /Edg\//i.test(ua) ? "Edge"
    : /OPR\//i.test(ua) ? "Opera"
    : /Chrome\//i.test(ua) ? "Chrome"
    : /Safari\//i.test(ua) ? "Safari"
    : /Firefox\//i.test(ua) ? "Firefox" : "متصفح آخر";
  return `${browser} · ${os}`;
};

export const ACTOR_ROLE_LABELS: Record<string, string> = {
  system: "النظام",
  buyer: "المشتري",
  seller: "البائع",
  admin: "الإدارة",
};

/* ------------------------------------------------------------------ */
/* Server calls                                                        */
/* ------------------------------------------------------------------ */

const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "يجب تسجيل الدخول",
  not_authorized: "لا تملك صلاحية تنفيذ هذا الإجراء",
  order_not_found: "الطلب غير موجود",
  invalid_status: "حالة غير صحيحة",
  invalid_transition: "لا يمكن الانتقال إلى هذه الحالة من الحالة الحالية",
  duplicate_status: "الطلب موجود بهذه الحالة بالفعل",
  order_frozen: "الطلب مجمّد من قبل الإدارة ولا يمكن تعديله",
  order_not_closed: "لا يمكن إعادة فتح طلب غير مغلق",
  reason_required: "السبب مطلوب",
};

export const friendlyOrderError = (error: unknown): string => {
  const raw = (error as { message?: string })?.message || "";
  const key = Object.keys(ERROR_MESSAGES).find((k) => raw.includes(k));
  return key ? ERROR_MESSAGES[key] : "تعذّر تنفيذ العملية، حاول مرة أخرى";
};

export const changeOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  note?: string | null,
  override = false,
) => {
  const { ip, userAgent } = await getClientMeta();
  const { error } = await supabase.rpc("update_order_status", {
    _order_id: orderId,
    _status: status,
    _note: note || null,
    _ip_address: ip,
    _user_agent: userAgent,
    _override: override,
  });
  if (error) throw error;

  // Email/push notification pipeline (in-app notification is written server side).
  try {
    await supabase.functions.invoke("notify-customer-order-status", {
      body: { order_id: orderId, new_status: status, notes: note || undefined },
    });
  } catch {
    /* notification delivery must never block the status update */
  }
};

export interface ShippingInfoInput {
  courierName?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  deliveryNotes?: string | null;
  estimatedDelivery?: string | null;
}

export const saveShippingInfo = async (orderId: string, info: ShippingInfoInput) => {
  const { ip, userAgent } = await getClientMeta();
  const { error } = await supabase.rpc("set_order_shipping_info", {
    _order_id: orderId,
    _courier_name: info.courierName || null,
    _driver_name: info.driverName || null,
    _driver_phone: info.driverPhone || null,
    _delivery_notes: info.deliveryNotes || null,
    _estimated_delivery: info.estimatedDelivery || null,
    _ip_address: ip,
    _user_agent: userAgent,
  });
  if (error) throw error;
};

export const setOrderFreeze = async (orderId: string, frozen: boolean, reason?: string | null) => {
  const { ip, userAgent } = await getClientMeta();
  const { error } = await supabase.rpc("admin_set_order_freeze", {
    _order_id: orderId,
    _frozen: frozen,
    _reason: reason || null,
    _ip_address: ip,
    _user_agent: userAgent,
  });
  if (error) throw error;
};

export const reopenOrder = async (orderId: string, status: OrderStatus, reason: string) => {
  const { ip, userAgent } = await getClientMeta();
  const { error } = await supabase.rpc("admin_reopen_order", {
    _order_id: orderId,
    _status: status,
    _reason: reason,
    _ip_address: ip,
    _user_agent: userAgent,
  });
  if (error) throw error;
};

/* ------------------------------------------------------------------ */
/* Order timeline (audit trail)                                        */
/* ------------------------------------------------------------------ */

export interface TimelineEntry {
  id: string;
  status: string;
  from_status: string | null;
  changed_by_role: string;
  actor_name: string | null;
  notes: string | null;
  is_override: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const fetchOrderTimeline = async (orderId: string): Promise<TimelineEntry[]> => {
  const { data, error } = await supabase.rpc("get_order_timeline", { _order_id: orderId });
  if (error) throw error;
  return ((data as unknown as any[]) || []).map((r) => ({
    id: String(r.id),
    status: r.status,
    from_status: r.from_status ?? null,
    changed_by_role: r.changed_by_role ?? "system",
    actor_name: r.actor_name ?? null,
    notes: r.notes ?? null,
    is_override: !!r.is_override,
    ip_address: r.ip_address ? String(r.ip_address) : null,
    user_agent: r.user_agent ?? null,
    created_at: r.created_at,
  }));
};

/* ------------------------------------------------------------------ */
/* Seller performance                                                  */
/* ------------------------------------------------------------------ */

export interface SellerPerformance {
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  avg_prep_hours: number;
  avg_delivery_hours: number;
  cancellation_rate: number;
  return_rate: number;
  satisfaction_score: number;
  ratings_count: number;
}

export const fetchSellerPerformance = async (vendorId?: string | null): Promise<SellerPerformance> => {
  const { data, error } = await supabase.rpc("get_seller_performance", {
    _vendor_id: vendorId ?? null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  const num = (v: unknown) => Number(v ?? 0);
  return {
    total_orders: num(row?.total_orders),
    delivered_orders: num(row?.delivered_orders),
    cancelled_orders: num(row?.cancelled_orders),
    returned_orders: num(row?.returned_orders),
    avg_prep_hours: num(row?.avg_prep_hours),
    avg_delivery_hours: num(row?.avg_delivery_hours),
    cancellation_rate: num(row?.cancellation_rate),
    return_rate: num(row?.return_rate),
    satisfaction_score: num(row?.satisfaction_score),
    ratings_count: num(row?.ratings_count),
  };
};

/** Human readable duration in Arabic from a number of hours. */
export const formatHours = (hours: number): string => {
  if (!hours || hours <= 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} دقيقة`;
  if (hours < 48) return `${hours.toFixed(1)} ساعة`;
  return `${(hours / 24).toFixed(1)} يوم`;
};