import { Clock, Package, ShieldCheck } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import SectionHeader from "@/components/home/SectionHeader";

/**
 * Phase 2 section. Renders nothing at all until the `platform_marketplace`
 * feature flag is switched on by a super admin.
 */
const TurkeyMarketplace = () => {
  const { isEnabled, loading } = useFeatureFlags();

  if (loading || !isEnabled("platform_marketplace")) return null;

  return (
    <section className="py-7">
      <div className="container px-4">
        <SectionHeader
          eyebrow="🇹🇷 التسوق من تركيا"
          title="منتجات مستوردة من تركيا"
          subtitle="منتجات أصلية مختارة من المنصة، تُشترى بالدفع الإلكتروني."
          tone="accent"
        />

        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-accent/12 via-card to-primary/12 p-6 shadow-[var(--shadow-elegant)] md:p-8">
          <div className="pointer-events-none absolute -end-16 -top-16 h-52 w-52 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative grid gap-3 sm:grid-cols-3">
            {[
              { icon: Package, title: "منتجات أصلية", body: "مصدرها موردون معتمدون في تركيا." },
              { icon: Clock, title: "شحن دولي", body: "مدة توصيل تقديرية تظهر على كل منتج." },
              { icon: ShieldCheck, title: "شراء آمن", body: "الدفع يتم إلكترونياً لحساب المنصة." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border/60 bg-background/70 p-4 backdrop-blur-sm">
                <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-bold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TurkeyMarketplace;
