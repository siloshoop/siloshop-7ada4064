import {
  LayoutDashboard, Users, Store, FileCheck, PackageSearch, ShoppingBag,
  FolderTree, Tag, LayoutTemplate, Image, Flag, MessagesSquare, Bell,
  BarChart3, DollarSign, Globe, Wallet, ToggleLeft, ScrollText, ShieldAlert,
  CreditCard, RotateCcw, Megaphone, UserCog, FileClock, Star, Ticket, Boxes,
  FileText, Settings, SlidersHorizontal, MapPin,
} from "lucide-react";
import type { FeatureFlagKey } from "@/hooks/useFeatureFlags";

export interface AdminModule {
  label: string;
  description: string;
  href: string;
  icon: typeof Users;
  /** When set, the module only appears once the flag is enabled. */
  featureFlag?: FeatureFlagKey;
  comingSoon?: boolean;
}

export const ADMIN_MODULES: AdminModule[] = [
  { label: "الرئيسية", description: "نظرة عامة على المنصة", href: "/admin", icon: LayoutDashboard },
  { label: "المشترون", description: "إدارة حسابات المشترين", href: "/admin/buyers", icon: Users },
  { label: "البائعون", description: "إدارة حسابات البائعين", href: "/admin/sellers", icon: Store },
  { label: "طلبات الانتساب", description: "مراجعة طلبات فتح المتاجر", href: "/admin/seller-applications", icon: FileCheck },
  { label: "منتجات البائعين", description: "الموافقة على المنتجات ورفضها", href: "/admin/products", icon: PackageSearch },
  { label: "الطلبات", description: "متابعة الطلبات وحالاتها", href: "/admin/orders", icon: ShoppingBag },
  { label: "المدفوعات", description: "سجل عمليات الدفع للعرض فقط", href: "/admin/payments", icon: CreditCard },
  { label: "المتاجر", description: "متاجر البائعين المعتمدة", href: "/admin/stores", icon: Store },
  { label: "الفئات", description: "الفئات والفئات الفرعية", href: "/admin/categories", icon: FolderTree },
  { label: "العلامات التجارية", description: "إدارة الماركات", href: "/admin/brands", icon: Tag },
  { label: "خصائص المنتجات", description: "الخصائص العالمية (اللون، المقاس، ...)", href: "/admin/attributes", icon: SlidersHorizontal },
  { label: "أقسام الصفحة الرئيسية", description: "واجهة العرض والترتيب", href: "/admin/homepage", icon: LayoutTemplate },
  { label: "البانرات", description: "الإعلانات الترويجية الداخلية", href: "/admin/banners", icon: Image },
  { label: "البلاغات", description: "بلاغات المنتجات والبائعين", href: "/admin/reports", icon: Flag },
  { label: "المخالفات", description: "إنذارات ومخالفات البائعين", href: "/admin/violations", icon: ShieldAlert },
  { label: "المحادثات", description: "الإشراف على الدردشة", href: "/admin/chats", icon: MessagesSquare },
  { label: "الإشعارات", description: "إرسال إشعارات للمستخدمين", href: "/admin/notifications", icon: Bell },
  { label: "التقييمات", description: "إخفاء التقييمات المخالفة", href: "/admin/reviews", icon: Star },
  { label: "الكوبونات", description: "أكواد خصم البائعين", href: "/admin/coupons", icon: Ticket },
  { label: "المخزون", description: "منتجات نفدت أو منخفضة", href: "/admin/inventory", icon: Boxes },
  { label: "مراكز الاستلام", description: "مراكز استلام الطلبات في كل محافظة", href: "/admin/pickup-centers", icon: MapPin },
  { label: "إدارة المحتوى", description: "الأسئلة الشائعة وصفحات السياسات", href: "/admin/content", icon: FileText },

  { label: "إعدادات النظام", description: "بيانات المنصة ووضع الصيانة", href: "/admin/settings", icon: Settings },
  { label: "الإحصائيات", description: "لوحة التحليلات التفصيلية", href: "/admin/statistics", icon: BarChart3 },
  { label: "الإيرادات", description: "إيرادات الدفع عند الاستلام", href: "/admin/revenue", icon: DollarSign },
  { label: "الإعلانات النصية", description: "الشريط العلوي والتنبيهات", href: "/admin/announcements", icon: Megaphone },
  { label: "الأدوار والصلاحيات", description: "منح وسحب صلاحيات الإدارة", href: "/admin/roles", icon: UserCog },
  { label: "سجل التدقيق", description: "كل عمليات الإدارة مع القيم السابقة", href: "/admin/audit", icon: FileClock },
  { label: "سجل النشاط", description: "سجل عمليات الإدارة", href: "/admin/activity", icon: ScrollText },
  { label: "خصائص المنصة", description: "تشغيل وإيقاف الوحدات المستقبلية", href: "/admin/features", icon: ToggleLeft },
  {
    label: "منتجات المنصة",
    description: "المنتجات المستوردة من تركيا",
    href: "/admin/platform-products",
    icon: Globe,
    featureFlag: "platform_marketplace",
    comingSoon: true,
  },
  {
    label: "إعدادات شام كاش",
    description: "بيانات التاجر وبوابة الدفع",
    href: "/admin/sham-cash",
    icon: Wallet,
    featureFlag: "sham_cash_payments",
    comingSoon: true,
  },
];

/** Modules that stay hidden until their feature flag is activated. */
export const FUTURE_MODULES = ADMIN_MODULES.filter((m) => !!m.featureFlag);