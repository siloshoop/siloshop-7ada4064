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
    <section className="py-7">
      <div className="container px-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {advantages.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-center shadow-[var(--shadow-card)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-bold">{title}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StoreAdvantages;
