import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Crown, Rocket, HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import pricingBasic from "@/assets/pricing-basic.jpg";
import pricingPro from "@/assets/pricing-pro.jpg";
import pricingBusiness from "@/assets/pricing-business.jpg";

type Billing = "monthly" | "yearly";

const plans = [
  {
    id: "basic",
    name: "البداية",
    icon: Rocket,
    image: pricingBasic,
    description: "مثالية للبائعين الجدد الذين يبدؤون رحلتهم",
    monthly: 0,
    yearly: 0,
    cta: "ابدأ مجاناً",
    features: [
      "حتى 20 منتجاً",
      "متجر إلكتروني أساسي",
      "دعم العملاء عبر البريد",
      "نظام طلبات بسيط",
      "تقارير شهرية",
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "الاحترافية",
    icon: Sparkles,
    image: pricingPro,
    description: "الأكثر شعبية للمتاجر النامية",
    monthly: 99000,
    yearly: 990000,
    cta: "اشترك الآن",
    features: [
      "منتجات غير محدودة",
      "كوبونات وعروض ترويجية",
      "تقارير تحليلية متقدمة",
      "دعم فني خلال 24 ساعة",
      "نظام محادثة مع العملاء",
      "خصومات الكميات التلقائية",
    ],
    highlight: true,
  },
  {
    id: "business",
    name: "الأعمال",
    icon: Crown,
    image: pricingBusiness,
    description: "للمتاجر الكبيرة والعلامات التجارية",
    monthly: 249000,
    yearly: 2490000,
    cta: "تواصل مع المبيعات",
    features: [
      "كل مميزات الاحترافية",
      "مدير حساب مخصص",
      "تكاملات API مخصصة",
      "أولوية في الظهور والإعلانات",
      "تدريب لفريقك",
      "اتفاقية مستوى خدمة (SLA)",
    ],
    highlight: false,
  },
];

const faqs = [
  { q: "هل يمكنني تغيير الباقة لاحقاً؟", a: "نعم، يمكنك الترقية أو التخفيض في أي وقت من لوحة التحكم." },
  { q: "هل هناك عمولات إضافية على المبيعات؟", a: "لا توجد عمولات خفية، فقط رسوم الاشتراك الشهري أو السنوي." },
  { q: "هل يمكنني تجربة الباقة قبل الدفع؟", a: "نعم، باقة البداية مجانية بالكامل وتمنحك تجربة كاملة للمنصة." },
  { q: "ما هي طرق الدفع المقبولة؟", a: "نقبل الدفع عبر بطاقات الائتمان، التحويل البنكي، والمحافظ الإلكترونية المحلية." },
];

const formatPrice = (price: number) => {
  if (price === 0) return "مجاناً";
  return `${price.toLocaleString("ar-SY")} ل.س`;
};

const Pricing = () => {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-4">باقات مرنة لكل الأحجام</Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">اختر الباقة المناسبة لمتجرك</h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              أسعار شفافة بدون رسوم خفية، ابدأ مجاناً وطوّر متجرك في أي وقت.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-12">
            <div className="inline-flex rounded-full border p-1 bg-card">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                شهري
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billing === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                سنوي <Badge variant="secondary" className="mr-1">وفّر 17%</Badge>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const price = billing === "monthly" ? plan.monthly : plan.yearly;
              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden transition-all hover:shadow-xl ${
                    plan.highlight ? "border-primary border-2 md:scale-105 shadow-lg" : ""
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute top-0 inset-x-0 bg-primary text-primary-foreground text-center text-xs font-bold py-1">
                      الأكثر اختياراً
                    </div>
                  )}
                  <div className={`aspect-[4/3] overflow-hidden bg-muted ${plan.highlight ? "mt-6" : ""}`}>
                    <img
                      src={plan.image}
                      alt={plan.name}
                      loading="lazy"
                      width={1024}
                      height={768}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="text-2xl font-bold">{plan.name}</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">{plan.description}</p>
                    <div className="mb-6">
                      <div className="text-3xl font-bold">{formatPrice(price)}</div>
                      {price > 0 && (
                        <div className="text-sm text-muted-foreground">
                          /{billing === "monthly" ? "شهرياً" : "سنوياً"}
                        </div>
                      )}
                    </div>
                    <Button
                      asChild
                      className="w-full mb-6"
                      variant={plan.highlight ? "default" : "outline"}
                    >
                      <Link to={plan.id === "business" ? "/contact" : "/auth"}>{plan.cta}</Link>
                    </Button>
                    <ul className="space-y-3">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <section className="mb-20">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-3">شرح مفصّل لكل باقة</h2>
              <p className="text-muted-foreground">تعرّف على ما تقدّمه كل باقة بالتفصيل</p>
            </div>
            <div className="space-y-12">
              {plans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center ${
                    idx % 2 === 1 ? "md:[direction:rtl]" : ""
                  }`}
                >
                  <div className="rounded-2xl overflow-hidden bg-muted aspect-[4/3]">
                    <img
                      src={plan.image}
                      alt={plan.name}
                      loading="lazy"
                      width={1024}
                      height={768}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="[direction:rtl]">
                    <Badge variant="secondary" className="mb-2">باقة {plan.name}</Badge>
                    <h3 className="text-2xl font-bold mb-3">{plan.description}</h3>
                    <p className="text-muted-foreground mb-4">
                      مصمَّمة خصيصاً لتلبية احتياجاتك في هذه المرحلة من نمو متجرك. اختر هذه الباقة إذا كنت تبحث عن
                      {" "}
                      {plan.id === "basic" && "بداية بسيطة وسريعة لاختبار فكرتك دون أي التزام مالي."}
                      {plan.id === "pro" && "أدوات متقدمة لزيادة المبيعات وتحليل أداء متجرك بدقة."}
                      {plan.id === "business" && "حلول مخصصة ودعم متميز لإدارة عمليات بيع واسعة النطاق."}
                    </p>
                    <ul className="space-y-2 mb-5">
                      {plan.features.slice(0, 4).map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant={plan.highlight ? "default" : "outline"}>
                      <Link to={plan.id === "business" ? "/contact" : "/auth"}>{plan.cta}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary mb-3">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h2 className="text-3xl font-bold">أسئلة شائعة عن الباقات</h2>
            </div>
            <div className="max-w-2xl mx-auto">
              <Accordion type="single" collapsible>
                {faqs.map((f, i) => (
                  <AccordionItem key={i} value={`f-${i}`}>
                    <AccordionTrigger className="text-right">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">هل تحتاج باقة مخصصة؟</h2>
            <p className="text-muted-foreground mb-5">نصمّم حلولاً مرنة تناسب احتياجات مشروعك الفريدة</p>
            <Button asChild size="lg">
              <Link to="/contact">تحدّث مع فريقنا</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;