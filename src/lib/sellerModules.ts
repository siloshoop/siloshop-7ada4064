import {
  LayoutDashboard, Package, PlusCircle, Boxes, ShoppingBag, Undo2, Users,
  MessageSquare, Star, Megaphone, Percent, BarChart3, FileText, Bell, Settings, ShieldAlert, History,
} from "lucide-react";

export interface SellerModule {
  key: string;
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  group: "overview" | "catalog" | "sales" | "growth" | "account";
}

/** Single source of truth for the seller dashboard navigation (selling only, no buyer features). */
export const SELLER_MODULES: SellerModule[] = [
  { key: "home", label: "لوحة التحكم", path: "/seller", icon: LayoutDashboard, group: "overview" },
  { key: "products", label: "المنتجات", path: "/seller/products", icon: Package, group: "catalog" },
  { key: "add-product", label: "إضافة منتج", path: "/dashboard/add-product", icon: PlusCircle, group: "catalog" },
  { key: "inventory", label: "المخزون", path: "/seller/inventory", icon: Boxes, group: "catalog" },
  { key: "stock-log", label: "سجل حركات المخزون", path: "/seller/stock-log", icon: History, group: "catalog" },
  { key: "orders", label: "الطلبات", path: "/dashboard/orders", icon: ShoppingBag, group: "sales" },
  { key: "returns", label: "المرتجعات", path: "/dashboard/returns", icon: Undo2, group: "sales" },
  { key: "customers", label: "العملاء", path: "/seller/customers", icon: Users, group: "sales" },
  { key: "messages", label: "الرسائل", path: "/messages", icon: MessageSquare, group: "sales" },
  { key: "reviews", label: "التقييمات", path: "/seller/reviews", icon: Star, group: "growth" },
  { key: "marketing", label: "التسويق والعروض", path: "/dashboard/deals", icon: Megaphone, group: "growth" },
  { key: "coupons", label: "كوبونات الخصم", path: "/dashboard/coupons", icon: Percent, group: "growth" },
  { key: "analytics", label: "الإحصائيات", path: "/dashboard/statistics", icon: BarChart3, group: "growth" },
  { key: "performance", label: "أداء المتجر", path: "/seller/performance", icon: Gauge, group: "growth" },
  { key: "reports", label: "التقارير", path: "/seller/reports", icon: FileText, group: "growth" },
  { key: "notifications", label: "الإشعارات", path: "/notifications", icon: Bell, group: "account" },
  { key: "violations", label: "المخالفات", path: "/seller/violations", icon: ShieldAlert, group: "account" },
  { key: "settings", label: "الإعدادات", path: "/settings", icon: Settings, group: "account" },
];

export const SELLER_GROUP_LABELS: Record<SellerModule["group"], string> = {
  overview: "نظرة عامة",
  catalog: "الكتالوج",
  sales: "البيع",
  growth: "النمو",
  account: "الحساب",
};
