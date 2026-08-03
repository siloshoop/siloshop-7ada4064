import type { ShowroomItemLive } from "@/hooks/useShowroom";
import luxuryFashion from "@/assets/showroom-demo/luxury-fashion-product.jpg";
import clothingStore from "@/assets/showroom-demo/modern-clothing-store.jpg";
import premiumProduct from "@/assets/showroom-demo/premium-product.jpg";
import featuredStore from "@/assets/showroom-demo/featured-store.jpg";
import logoGold from "@/assets/showroom-demo/logo-gold.png";
import logoViolet from "@/assets/showroom-demo/logo-violet.png";

/**
 * Visual-only preview data for the Premium Showroom.
 * NEVER inserted into the database and never rendered on the homepage —
 * used exclusively inside the Super Admin preview dialog.
 */
const base = {
  display_order: 0,
  is_pinned: false,
  is_active: true,
  start_date: null,
  end_date: null,
  campaign_type: "editorial",
  sponsor_name: null,
  priority: 0,
  vendor_id: null,
  product_id: null,
  link_url: null,
};

export const showroomDemoItems: ShowroomItemLive[] = [
  {
    ...base,
    id: "demo-store-1",
    item_type: "store",
    title: "متجر أوريليان للأزياء",
    subtitle: "أزياء عصرية مختارة بعناية — توصيل إلى جميع المحافظات السورية.",
    cover_image_url: clothingStore,
    logo_url: logoViolet,
    rating: 4.8,
    is_verified: true,
    badge_label: "متجر موثّق",
    display_order: 1,
  },
  {
    ...base,
    id: "demo-product-1",
    item_type: "product",
    title: "فستان حريري فاخر للسهرات",
    subtitle: "قماش حريري ناعم بلمسة لامعة، متوفر بعدة مقاسات وألوان.",
    cover_image_url: luxuryFashion,
    logo_url: logoGold,
    rating: 4.9,
    is_verified: true,
    badge_label: "خصم 25%",
    display_order: 2,
    price: 1200000,
    discount_price: 900000,
  },
  {
    ...base,
    id: "demo-product-2",
    item_type: "product",
    title: "حقيبة يد جلد طبيعي",
    subtitle: "جلد طبيعي مدبوغ يدويًا مع إكسسوارات ذهبية.",
    cover_image_url: premiumProduct,
    logo_url: logoGold,
    rating: 4.7,
    is_verified: false,
    badge_label: null,
    display_order: 3,
    price: 650000,
    discount_price: null,
  },
  {
    ...base,
    id: "demo-store-2",
    item_type: "store",
    title: "بوتيك سيلو الفاخر",
    subtitle: "تجربة تسوّق راقية مع خدمة عملاء مميزة.",
    cover_image_url: featuredStore,
    logo_url: logoViolet,
    rating: 4.6,
    is_verified: true,
    badge_label: "الأكثر زيارة",
    display_order: 4,
  },
];