import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "المعلومات التي نجمعها",
    body: "نجمع الاسم، البريد الإلكتروني، رقم الهاتف، والمحافظة وعنوان التوصيل، بالإضافة إلى بيانات الطلبات والتقييمات والرسائل داخل المنصة. لا نجمع أي بيانات بطاقات بنكية لأن الدفع يتم نقدًا عند الاستلام فقط.",
  },
  {
    title: "كيف نستخدم بياناتك",
    body: "تُستخدم بياناتك لتنفيذ الطلبات وتوصيلها، والتواصل معك بخصوص حالة الطلب، ودعم العملاء، وتحسين تجربة التسوق، ومنع الاحتيال وإساءة الاستخدام.",
  },
  {
    title: "مشاركة البيانات",
    body: "يطّلع البائع على الحد الأدنى من بياناتك اللازم لتنفيذ الطلب (الاسم، المحافظة، رقم التواصل عند الحاجة). لا نبيع بياناتك لأي طرف ثالث.",
  },
  {
    title: "حماية البيانات",
    body: "تُحفظ البيانات في قاعدة بيانات محمية بسياسات وصول صارمة على مستوى الصفوف (RLS)، ولا يمكن لأي مستخدم الوصول إلى بيانات غيره.",
  },
  {
    title: "حقوقك",
    body: "يمكنك تعديل بياناتك من صفحة الملف الشخصي، أو التحكم بإشعاراتك من إعدادات الإشعارات، أو طلب حذف حسابك بالتواصل معنا.",
  },
  {
    title: "التواصل",
    body: "لأي استفسار حول الخصوصية يمكنك مراسلتنا عبر صفحة اتصل بنا.",
  },
];

const Privacy = () => (
  <div className="min-h-screen bg-background" dir="rtl">
    <Navbar />
    <main className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">سياسة الخصوصية</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        نوضح في هذه الصفحة كيف نجمع بياناتك ونستخدمها ونحميها داخل منصة سيلو شوب.
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

export default Privacy;
