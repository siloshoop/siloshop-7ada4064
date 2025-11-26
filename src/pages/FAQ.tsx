import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQ = () => {
  const faqs = [
    {
      question: "كيف يمكنني إنشاء حساب؟",
      answer: "يمكنك إنشاء حساب بالنقر على زر تسجيل الدخول في أعلى الصفحة واختيار إنشاء حساب جديد. ستحتاج إلى إدخال بريدك الإلكتروني وكلمة مرور آمنة."
    },
    {
      question: "كيف أقوم بتتبع طلبي؟",
      answer: "بعد تأكيد طلبك، ستتلقى رقم تتبع عبر البريد الإلكتروني. يمكنك استخدام هذا الرقم في صفحة تتبع الطلبات لمعرفة حالة شحنتك."
    },
    {
      question: "ما هي طرق الدفع المتاحة؟",
      answer: "نقبل الدفع عند الاستلام، وبطاقات الائتمان، والدفع الإلكتروني من خلال بوابات الدفع المحلية السورية."
    },
    {
      question: "كم من الوقت يستغرق الشحن؟",
      answer: "عادة ما يستغرق التوصيل من 2-5 أيام عمل داخل سوريا، حسب موقعك."
    },
    {
      question: "ما هي سياسة الإرجاع؟",
      answer: "يمكنك إرجاع المنتجات خلال 14 يوماً من تاريخ الاستلام، بشرط أن يكون المنتج في حالته الأصلية مع العبوة الأصلية."
    },
    {
      question: "كيف يمكنني أن أصبح بائعاً؟",
      answer: "يمكنك التسجيل كبائع من خلال صفحة تسجيل الدخول واختيار خيار مقدم الخدمة. سيتم مراجعة طلبك من قبل فريقنا."
    },
    {
      question: "هل يمكنني تعديل طلبي بعد تأكيده؟",
      answer: "يمكنك تعديل طلبك خلال 24 ساعة من تأكيده عن طريق التواصل مع خدمة العملاء."
    },
    {
      question: "كيف أحصل على خصومات وعروض؟",
      answer: "اشترك في نشرتنا البريدية لتلقي أحدث العروض والخصومات الحصرية. كما يمكنك متابعة صفحاتنا على وسائل التواصل الاجتماعي."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">الأسئلة الشائعة</h1>
            <p className="text-muted-foreground text-lg">إجابات على الأسئلة الأكثر شيوعاً</p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg px-6">
                <AccordionTrigger className="text-right hover:no-underline">
                  <span className="font-semibold">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default FAQ;
