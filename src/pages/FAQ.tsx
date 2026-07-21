import { useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, HelpCircle, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import faqOrders from "@/assets/faq-orders.jpg";
import faqShipping from "@/assets/faq-shipping.jpg";
import faqReturns from "@/assets/faq-returns.jpg";
import faqAccount from "@/assets/faq-account.jpg";
import faqProducts from "@/assets/faq-products.jpg";

const faqCategories = [
  {
    id: "orders",
    title: "الطلبات والشراء",
    image: faqOrders,
    description: "كل ما يخص تقديم الطلبات وتعديلها وتتبعها",
    questions: [
      { question: "كيف يمكنني تقديم طلب؟", answer: "تصفّح المنتجات، أضِف ما تريده إلى السلة، ثم انتقل إلى صفحة إتمام الطلب وأكمل معلومات الشحن لإتمام الطلب." },
      { question: "هل يمكنني تعديل طلبي بعد تقديمه؟", answer: "يمكنك التعديل خلال 30 دقيقة من التقديم عبر التواصل مع خدمة العملاء، وبعدها يبدأ معالجة الطلب." },
      { question: "ما هي طرق الدفع المتاحة؟", answer: "الدفع عند الاستلام أو عن طريق شام كاش." },
      { question: "كيف أتتبع طلبي؟", answer: "من صفحة (طلباتي) في حسابك، وستصلك أيضاً إشعارات بكل مرحلة من مراحل التوصيل." },
    ],
  },
  {
    id: "shipping",
    title: "الشحن والتوصيل",
    image: faqShipping,
    description: "أوقات وأسعار التوصيل لجميع المحافظات السورية",
    questions: [
      { question: "كم تستغرق مدة التوصيل؟", answer: "بين 2-5 أيام عمل: دمشق وريفها 2-3 أيام، المدن الرئيسية 3-4 أيام، المحافظات الأخرى 4-5 أيام." },
      { question: "كم تكلفة الشحن؟", answer: "أقل من 50,000 ل.س: 5,000 ل.س — من 50,000 إلى 100,000 ل.س: 3,000 ل.س — أكثر من 100,000 ل.س: شحن مجاني." },
      { question: "هل يمكنني تحديد وقت التوصيل؟", answer: "نعم. يعتمد وقت التوصيل على البائع وشركة الشحن. إذا كنت بحاجة لتغيير وقت التوصيل، يرجى التواصل مع البائع أو شركة الشحن إذا كان الطلب قد شُحن بالفعل." },
      { question: "ماذا لو لم أكن متواجداً وقت التوصيل؟", answer: "نتواصل معك لإعادة الجدولة، أو يمكنك تحديد شخص آخر لاستلام الطلب." },
    ],
  },
  {
    id: "returns",
    title: "الإرجاع والاستبدال",
    image: faqReturns,
    description: "سياسة واضحة لإرجاع المنتجات واسترداد المبالغ",
    questions: [
      { question: "ما هي مدة الإرجاع؟", answer: "14 يوماً من تاريخ الاستلام، شرط أن يكون المنتج بحالته الأصلية مع العبوة والفاتورة." },
      { question: "ما هي المنتجات التي لا يمكن إرجاعها؟", answer: "منتجات النظافة الشخصية، المواد الغذائية، البرمجيات الرقمية، والمنتجات المخصصة حسب الطلب." },
      { question: "كيف أطلب إرجاع منتج؟", answer: "من صفحة (طلباتي)، افتح تفاصيل الطلب واضغط على (طلب إرجاع). اختر سبب الإرجاع، أضف ملاحظات، وارفق صوراً أو فيديو إن لزم. أرسل الطلب وسيراجعه البائع. يمكنك متابعة حالة طلب الإرجاع من صفحة (طلباتي) أو (طلبات الإرجاع)، وإذا تمت الموافقة ستصلك تعليمات إرجاع المنتج." },
      { question: "متى سأستلم المبلغ المسترد؟", answer: "خلال 7-14 يوم عمل بعد استلام المنتج والتحقق من حالته، إلى نفس وسيلة الدفع." },
    ],
  },
  {
    id: "account",
    title: "الحساب والأمان",
    image: faqAccount,
    description: "إنشاء الحساب وحماية بياناتك الشخصية",
    questions: [
      { question: "كيف أنشئ حساباً جديداً؟", answer: "اضغط (تسجيل الدخول) ثم (إنشاء حساب جديد)، أدخل بياناتك وستتلقى رمز تحقق عبر البريد." },
      { question: "هل معلوماتي الشخصية آمنة؟", answer: "نعم، نستخدم أحدث تقنيات التشفير ولا نشارك بياناتك مع أي طرف ثالث دون موافقتك." },
      { question: "نسيت كلمة المرور، ماذا أفعل؟", answer: "من صفحة تسجيل الدخول اضغط (نسيت كلمة المرور) وستتلقى رابطاً لإعادة تعيينها." },
      { question: "كيف أغير معلومات حسابي؟", answer: "من لوحة التحكم في حسابك يمكنك تحديث معلوماتك الشخصية وعناوين الشحن وكلمة المرور." },
    ],
  },
  {
    id: "products",
    title: "المنتجات والأسعار",
    image: faqProducts,
    description: "كل ما يخص الأسعار، التوفر، والخصومات",
    questions: [
      { question: "هل الأسعار تشمل الضرائب؟", answer: "نعم، جميع الأسعار شاملة للضريبة، والسعر النهائي هو ما ستدفعه (مضافاً إليه الشحن إن وجد)." },
      { question: "كيف أعرف إذا كان المنتج متوفراً؟", answer: "تظهر حالة التوفر في صفحة المنتج، ويمكنك تفعيل (أخبرني عند التوفر) عند نفاد الكمية." },
      { question: "هل يمكنني الحصول على خصومات للطلبات الكبيرة؟", answer: "نعم، تطبَّق خصومات تلقائية على الكميات الكبيرة، ويمكنك استخدام أكواد الخصم في صفحة إتمام الطلب." },
      { question: "هل المنتجات أصلية ومضمونة؟", answer: "جميع المنتجات أصلية 100% ومن موردين موثوقين، مع ضمانات حسب سياسة كل منتج." },
    ],
  },
];

const FAQ = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqCategories
      .filter((c) => !activeId || c.id === activeId)
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (qq) =>
            !q ||
            qq.question.toLowerCase().includes(q) ||
            qq.answer.toLowerCase().includes(q),
        ),
      }))
      .filter((category) => category.questions.length > 0);
  }, [searchQuery, activeId]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
              <HelpCircle className="h-7 w-7" />
            </div>
            <h1 className="text-4xl font-bold mb-3">الأسئلة الشائعة</h1>
            <p className="text-muted-foreground text-lg">إجابات سريعة لأكثر الأسئلة التي يطرحها عملاؤنا</p>
          </div>

          <div className="relative max-w-xl mx-auto mb-10">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن سؤالك..."
              className="pr-10 h-12"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
            <button
              onClick={() => setActiveId(null)}
              className={`rounded-xl border p-3 text-sm font-medium transition-all ${
                activeId === null ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary"
              }`}
            >
              كل المواضيع
            </button>
            {faqCategories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id === activeId ? null : c.id)}
                className={`rounded-xl border p-3 text-sm font-medium transition-all ${
                  activeId === c.id ? "bg-primary text-primary-foreground border-primary" : "hover:border-primary"
                }`}
              >
                {c.title}
              </button>
            ))}
          </div>

          {filteredCategories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              لا توجد نتائج مطابقة. حاول كلمة بحث أخرى.
            </div>
          ) : (
            <div className="space-y-10">
              {filteredCategories.map((category) => (
                <Card key={category.id} className="overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-0">
                    <div className="relative aspect-[4/3] md:aspect-auto bg-muted overflow-hidden">
                      <img
                        src={category.image}
                        alt={category.title}
                        loading="lazy"
                        width={1024}
                        height={640}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent md:bg-gradient-to-l" />
                      <div className="absolute bottom-0 inset-x-0 p-4 md:p-5">
                        <h2 className="text-xl font-bold">{category.title}</h2>
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <Accordion type="single" collapsible className="w-full">
                        {category.questions.map((q, idx) => (
                          <AccordionItem key={idx} value={`${category.id}-${idx}`}>
                            <AccordionTrigger className="text-right">{q.question}</AccordionTrigger>
                            <AccordionContent className="text-muted-foreground leading-relaxed">
                              {q.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-16 rounded-2xl border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center">
            <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-2">لم تجد إجابة لسؤالك؟</h2>
            <p className="text-muted-foreground mb-5">فريق خدمة العملاء جاهز للرد عليك في أي وقت</p>
            <Button asChild>
              <Link to="/contact">تواصل معنا</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQ;