import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

const sections = [
  {
    title: "قبول الشروط",
    body: "باستخدامك منصة سيلو شوب فإنك توافق على هذه الشروط. إذا لم توافق عليها يرجى عدم استخدام المنصة.",
  },
  {
    title: "الحساب",
    body: "يجب تقديم معلومات صحيحة عند التسجيل وتفعيل البريد الإلكتروني. أنت مسؤول عن الحفاظ على سرية بيانات دخولك.",
  },
  {
    title: "الطلبات والدفع",
    body: "وسيلة الدفع الوحيدة المتاحة حاليًا هي الدفع نقدًا عند الاستلام. يمكن إلغاء الطلب قبل شحنه، وتُحسب تكلفة الشحن حسب ما يحدده البائع لكل منتج.",
  },
  {
    title: "التزامات البائعين",
    body: "على البائع تقديم وصف دقيق للمنتجات وصور حقيقية، والالتزام بمدة التجهيز المعلنة، وقبول سياسة الإرجاع المعتمدة في المنصة. تخضع منتجات البائعين لمراجعة الإدارة.",
  },
  {
    title: "الإرجاع والاستبدال",
    body: "يحق للمشتري طلب إرجاع المنتج خلال 7 أيام من الاستلام وفق شروط سياسة الإرجاع المنشورة في صفحة سياسة الإرجاع.",
  },
  {
    title: "المحتوى والسلوك",
    body: "يُمنع نشر محتوى مخالف أو مضلل أو مسيء في المنتجات أو التقييمات أو المحادثات. يحق للإدارة إخفاء المحتوى أو إيقاف الحساب عند المخالفة.",
  },
  {
    title: "تعديل الشروط",
    body: "قد نقوم بتحديث هذه الشروط، ويسري التحديث فور نشره على هذه الصفحة.",
  },
];

const Terms = () => (
  <div className="min-h-screen bg-background" dir="rtl">
    <Navbar />
    <main className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <ScrollText className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">الشروط والأحكام</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        تنظّم هذه الشروط استخدامك لمنصة سيلو شوب كمشترٍ أو بائع.
      </p>
      <div className="space-y-4">
        {sections.map((s) => (
          <Card key={s.title}>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-2">{s.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{s.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
    <Footer />
  </div>
);

export default Terms;
