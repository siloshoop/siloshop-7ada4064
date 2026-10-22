import { type ComponentType, type SVGProps } from "react";
import { BookOpen, Car, Footprints, Gamepad2, Gem, Laptop, PawPrint, Shirt, Sofa, Trophy } from "lucide-react";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
const svg = (d: React.ReactNode): Icon => (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>{d}</svg>
);
const Dress = svg(<><path d="M9 2v3l-1 4h8l-1-4V2" /><path d="M8 9 4.5 21h15L16 9" /></>);
const Lipstick = svg(<><path d="M9 11V6l3-4 3 3v6" /><rect x="7.5" y="11" width="9" height="4" rx="1" /><rect x="7" y="15" width="10" height="7" rx="1.5" /></>);
const Handbag = svg(<><path d="M8 9V6a4 4 0 0 1 8 0v3" /><path d="M4.5 9h15l-1.2 11a2 2 0 0 1-2 1.8H7.7a2 2 0 0 1-2-1.8z" /></>);
const Teddy = svg(<><circle cx="6.5" cy="5.5" r="2.5" /><circle cx="17.5" cy="5.5" r="2.5" /><circle cx="12" cy="10" r="5.5" /><path d="M10.5 11.5c.8.7 2.2.7 3 0" /><circle cx="10" cy="9" r=".5" fill="currentColor" /><circle cx="14" cy="9" r=".5" fill="currentColor" /><path d="M7 15.5 6 21h12l-1-5.5" /></>);

export type CategoryTone = "rose" | "violet" | "sky" | "mint" | "peach" | "lemon" | "teal";
export const CATEGORY_DEFAULTS: { name: string; icon: Icon; tone: CategoryTone }[] = [
  { name: "الأحذية", icon: Footprints, tone: "peach" },
  { name: "أزياء نسائية", icon: Dress, tone: "rose" },
  { name: "الإلكترونيات", icon: Laptop, tone: "sky" },
  { name: "أزياء رجالية", icon: Shirt, tone: "violet" },
  { name: "الرياضة والأنشطة الخارجية", icon: Trophy, tone: "lemon" },
  { name: "مستحضرات التجميل", icon: Lipstick, tone: "rose" },
  { name: "المنزل والأثاث", icon: Sofa, tone: "teal" },
  { name: "الحقائب", icon: Handbag, tone: "peach" },
  { name: "المجوهرات والإكسسوارات", icon: Gem, tone: "violet" },
  { name: "الألعاب", icon: Gamepad2, tone: "sky" },
  { name: "الكتب", icon: BookOpen, tone: "mint" },
  { name: "الأطفال", icon: Teddy, tone: "lemon" },
  { name: "مستلزمات الحيوانات الأليفة", icon: PawPrint, tone: "mint" },
  { name: "السيارات والدراجات", icon: Car, tone: "teal" },
];


export const CATEGORY_TONES: CategoryTone[] = ["rose", "violet", "sky", "mint", "peach", "lemon", "teal"];
export const CATEGORY_ICONS: Record<string, Icon> = { Footprints, Dress, Laptop, Shirt, Trophy, Lipstick, Sofa, Handbag, Gem, Gamepad2, BookOpen, Teddy, PawPrint, Car };
export const categoryAppearance = (category: { name_ar: string; icon?: string | null; color?: string | null }) => {
  const saved = CATEGORY_DEFAULTS.find((item) => item.name === category.name_ar);
  const tone = CATEGORY_TONES.includes(category.color as CategoryTone) ? category.color as CategoryTone : saved?.tone ?? "violet";
  return { tone, Icon: CATEGORY_ICONS[category.icon ?? ""] ?? saved?.icon ?? Handbag, emoji: category.icon && !CATEGORY_ICONS[category.icon] && /\p{Extended_Pictographic}/u.test(category.icon) ? category.icon : null };
};
