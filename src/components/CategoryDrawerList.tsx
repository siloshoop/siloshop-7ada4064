import { type ComponentType, type SVGProps } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Car, ChevronLeft, Footprints, Gamepad2, Gem, Laptop, PawPrint, Shirt, Sofa, Trophy } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
const svg = (d: React.ReactNode): Icon => (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>{d}</svg>
);
const Dress = svg(<><path d="M9 2v3l-1 4h8l-1-4V2" /><path d="M8 9 4.5 21h15L16 9" /></>);
const Lipstick = svg(<><path d="M9 11V6l3-4 3 3v6" /><rect x="7.5" y="11" width="9" height="4" rx="1" /><rect x="7" y="15" width="10" height="7" rx="1.5" /></>);
const Handbag = svg(<><path d="M8 9V6a4 4 0 0 1 8 0v3" /><path d="M4.5 9h15l-1.2 11a2 2 0 0 1-2 1.8H7.7a2 2 0 0 1-2-1.8z" /></>);
const Teddy = svg(<><circle cx="6.5" cy="5.5" r="2.5" /><circle cx="17.5" cy="5.5" r="2.5" /><circle cx="12" cy="10" r="5.5" /><path d="M10.5 11.5c.8.7 2.2.7 3 0" /><circle cx="10" cy="9" r=".5" fill="currentColor" /><circle cx="14" cy="9" r=".5" fill="currentColor" /><path d="M7 15.5 6 21h12l-1-5.5" /></>);

type Tone = "rose" | "violet" | "sky" | "mint" | "peach" | "lemon" | "teal";
const ITEMS: { name: string; icon: Icon; tone: Tone }[] = [
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

const CategoryDrawerList = ({ onNavigate }: { onNavigate: () => void }) => {
  const { data: categories = [] } = useCategories();
  const ids = Object.fromEntries(categories.map((c) => [c.name_ar, c.id]));

  return (
    <ul className="space-y-1">
      {ITEMS.map(({ name, icon: I, tone }) => (
        <li key={name}>
          <Link
            to={ids[name] ? `/categories?c=${ids[name]}` : "/categories"}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `hsl(var(--pastel-${tone}))`, color: `hsl(var(--pastel-${tone}-fg))` }}
            >
              <I className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug">{name}</span>
            <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default CategoryDrawerList;
