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
              className="gradient-edge-hover relative flex min-w-0 flex-col items-center gap-1 overflow-hidden rounded-2xl border border-border/60 bg-card p-1.5 pt-2.5 text-center shadow-card transition-shadow duration-300 hover:shadow-elegant sm:gap-2 sm:p-3 sm:pt-4 md:p-4 md:pt-5"
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-ad" />
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary shadow-sm sm:h-10 sm:w-10 md:h-11 md:w-11">
                <Icon className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
              </div>
              <h3 className="w-full break-words text-[0.625rem] font-bold leading-tight sm:text-sm">{title}</h3>
              <p className="w-full break-words text-[0.5625rem] leading-tight text-muted-foreground sm:text-[0.6875rem] md:text-xs">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StoreAdvantages;
