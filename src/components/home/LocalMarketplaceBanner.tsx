import { Link } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Banknote, RotateCcw, Store } from "lucide-react";

const PERKS = [
  { icon: BadgeCheck, title: "بائعون موثّقون", body: "كل متجر يخضع لمراجعة الإدارة قبل النشر." },
  { icon: Banknote, title: "دفع عند الاستلام", body: "ادفع نقداً عند وصول طلبك إلى بابك." },
  { icon: MessageCircle, title: "تواصل مع البائع", body: "محادثة مباشرة مع بائع طلبك لأي استفسار أو مشكلة." },
];

const LocalMarketplaceBanner = () => (
  <section className="py-7">
    <div className="container px-4">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/12 via-card to-accent/12 p-6 shadow-[var(--shadow-elegant)] md:p-8">
        <div className="pointer-events-none absolute -end-16 -top-16 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -start-10 h-52 w-52 rounded-full bg-accent/15 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1.4fr] lg:items-center">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3.5 py-1.5 text-xs font-bold backdrop-blur-sm">
              🇸🇾 السوق المحلي
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              تسوّق من متاجر سوريا في مكان واحد
            </h2>
            <p className="max-w-md text-sm text-muted-foreground md:text-base">
              منتجات من بائعين محليين معتمدين، توصيل إلى جميع المحافظات، ودفع نقدي عند الاستلام فقط.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <Link
                to="/categories"
                className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-elegant)] transition-transform hover:scale-[1.02] motion-reduce:transition-none"
              >
                تسوّق الآن
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none" />
              </Link>
              <Link
                to="/seller/application"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Store className="h-4 w-4" />
                افتح متجرك
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {PERKS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transition-none"
              >
                <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default LocalMarketplaceBanner;
