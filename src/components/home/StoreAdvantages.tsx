import { Truck, Wallet, MessageCircle, ShieldCheck } from "lucide-react";

const advantages = [
  {
    icon: Truck,
    title: "توصيل سريع لكل المحافظات",
    description: "نوصل طلبك أينما كنت في سوريا",
  },
  {
    icon: Wallet,
    title: "الدفع عند الاستلام",
    description: "ادفع بأمان عند استلام طلبك",
  },
  {
    icon: MessageCircle,
    title: "تواصل مباشر مع البائع",
    description: "راسل بائع طلبك مباشرة لأي استفسار",
  },
  {
    icon: ShieldCheck,
    title: "بائعون موثوقون",
    description: "منتجات من بائعين تم التحقق منهم",
  },
];

const StoreAdvantages = () => {
  return (
    <section className="py-4">
      <div className="container px-4">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-3 md:gap-4">
          {advantages.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex min-w-0 flex-col items-center gap-1 sm:gap-2 rounded-xl sm:rounded-2xl border border-border/60 bg-card p-1.5 sm:p-3 md:p-4 text-center shadow-[var(--shadow-card)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 sm:h-10 sm:w-10 md:h-11 md:w-11">
                <Icon className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
              </div>
              <h3 className="text-[10px] font-bold leading-tight sm:text-sm">{title}</h3>
              <p className="hidden text-[11px] leading-tight text-muted-foreground sm:block md:text-xs">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StoreAdvantages;
