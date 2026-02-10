import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
const faqCategories = [{
  title: "الطلبات والشراء",
  questions: [{
    question: "كيف يمكنني تقديم طلب؟",
    answer: "لتقديم طلب، قم بتصفح المنتجات واختر ما تريد، ثم أضفه إلى سلة التسوق. بعد ذلك، انتقل إلى صفحة الدفع وأكمل معلومات الشحن والدفع لإتمام الطلب."
  }, {
    question: "هل يمكنني تعديل طلبي بعد تقديمه؟",
    answer: "يمكنك تعديل الطلب خلال 30 دقيقة من تقديمه عن طريق التواصل مع خدمة العملاء. بعد ذلك، لا يمكن إجراء تعديلات حيث يتم معالجة الطلب."
  }, {
    question: "ما هي طرق الدفع المتاحة؟",
    answer: "نوفر عدة طرق للدفع: الدفع عند الاستلام، التحويل البنكي، بطاقات الائتمان والخصم، والمحافظ الإلكترونية المحلية."
  }, {
    question: "كيف أتتبع طلبي؟",
    answer: 'يمكنك تتبع طلبك من خلال صفحة "طلباتي" في حسابك. ستتلقى أيضاً رسائل تحديث عبر البريد الإلكتروني والرسائل النصية عند كل مرحلة من مراحل التوصيل.'
  }]
}, {
  title: "الشحن والتوصيل",
  questions: [{
    question: "كم تستغرق مدة التوصيل؟",
    answer: "مدة التوصيل تتراوح بين 2-5 أيام عمل حسب موقعك. دمشق وريفها: 2-3 أيام، المدن الرئيسية: 3-4 أيام، المحافظات الأخرى: 4-5 أيام."
  }, {
    question: "كم تكلفة الشحن؟",
    answer: "تكلفة الشحن تعتمد على قيمة الطلب: أقل من 50,000 ل.س (5,000 ل.س)، من 50,000-100,000 ل.س (3,000 ل.س)، أكثر من 100,000 ل.س (شحن مجاني)."
  }, {
    question: "هل يمكنني تحديد وقت التوصيل؟",
    answer: "نعم، سيتصل بك مندوب التوصيل قبل الوصول لتحديد موعد مناسب. يمكنك أيضاً إعادة جدولة التوصيل مرة واحدة مجاناً."
  }, {
    question: "ماذا لو لم أكن متواجداً وقت التوصيل؟",
    answer: "إذا لم تكن متواجداً، سيتم التواصل معك لإعادة جدولة التوصيل. يمكنك أيضاً تحديد شخص آخر لاستلام الطلب نيابة عنك."
  }]
}, {
  title: "الإرجاع والاستبدال",
  questions: [{
    question: "ما هي مدة الإرجاع؟",
    answer: "يمكنك إرجاع المنتجات خلال 14 يوماً من تاريخ الاستلام، بشرط أن يكون المنتج في حالته الأصلية مع العبوة والفاتورة."
  }, {
    question: "ما هي المنتجات التي لا يمكن إرجاعها؟",
    answer: "المنتجات الشخصية والنظافة، المنتجات الغذائية والمشروبات، البرمجيات والمنتجات الرقمية، والمنتجات المخصصة حسب الطلب."
  }, {
    question: "كيف أطلب إرجاع أو استبدال؟",
    answer: 'تواصل مع خدمة العملاء عبر صفحة "اتصل بنا" أو الهاتف أو البريد الإلكتروني. سيتم تزويدك برقم إرجاع وتعليمات الشحن.'
  }, {
    question: "متى سأستلم المبلغ المسترد؟",
    answer: "بعد استلام المنتج المُرجع والتحقق من حالته، سيتم استرداد المبلغ خلال 7-14 يوم عمل إلى نفس طريقة الدفع الأصلية."
  }]
}, {
  title: "الحساب والأمان",
  questions: [{
    question: "كيف أنشئ حساباً جديداً؟",
    answer: 'انقر على "تسجيل الدخول" في أعلى الصفحة، ثم اختر "إنشاء حساب جديد". أدخل معلوماتك الأساسية وستتلقى رمز تحقق عبر البريد الإلكتروني.'
  }, {
    question: "هل معلوماتي الشخصية آمنة؟",
    answer: "نعم، نستخدم أحدث تقنيات التشفير لحماية معلوماتك الشخصية والمالية. لا نشارك بياناتك مع أطراف ثالثة دون موافقتك."
  }, {
    question: "نسيت كلمة المرور، ماذا أفعل؟",
    answer: 'في صفحة تسجيل الدخول، انقر على "نسيت كلمة المرور" وأدخل بريدك الإلكتروني. ستتلقى رابطاً لإعادة تعيين كلمة المرور.'
  }, {
    question: "كيف أغير معلومات حسابي؟",
    answer: 'سجل الدخول إلى حسابك، ثم انتقل إلى "لوحة التحكم" حيث يمكنك تحديث معلوماتك الشخصية وعناوين الشحن وكلمة المرور.'
  }]
}, {
  title: "المنتجات والأسعار",
  questions: [{
    question: "هل الأسعار تشمل الضرائب؟",
    answer: "نعم، جميع الأسعار المعروضة تشمل ضريبة القيمة المضافة. السعر النهائي الذي تراه هو ما ستدفعه (بالإضافة إلى رسوم الشحن)."
  }, {
    question: "كيف أعرف إذا كان المنتج متوفراً؟",
    answer: 'في صفحة المنتج، ستجد معلومات عن التوفر. إذا كان المنتج غير متوفر، يمكنك النقر على "أخبرني عند التوفر" لتلقي إشعار.'
  }, {
    question: "هل يمكنني الحصول على خصومات للطلبات الكبيرة؟",
    answer: "نعم، نوفر خصومات تلقائية على الكميات الكبيرة. كما يمكنك استخدام أكواد الخصم المتاحة في صفحة الدفع."
  }, {
    question: "هل المنتجات أصلية ومضمونة؟",
    answer: "نعم، جميع المنتجات في متجرنا أصلية 100% ومن موردين موثوقين. نوفر ضمانات للمنتجات حسب سياسة كل منتج."
  }]
}];
const FAQ = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredCategories = faqCategories.map(category => ({
    ...category,
    questions: category.questions.filter(q => q.question.toLowerCase().includes(searchQuery.toLowerCase()) || q.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  })).filter(category => category.questions.length > 0);
  return <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <HelpCircle className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-4">الأسئلة الشائعة</h1>
            <p className="text-muted-foreground text-lg">
              إجابات على الأسئلة الأكثر شيوعاً
            </p>
          </div>

          <div className="mb-8">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input type="search" placeholder="ابحث عن سؤال..." className="pr-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {filteredCategories.length === 0 ? <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  لم نجد أي نتائج لبحثك
                </p>
                <Button onClick={() => setSearchQuery("")}>مسح البحث</Button>
              </CardContent>
            </Card> : <div className="space-y-8">
              {filteredCategories.map((category, categoryIndex) => <Card key={categoryIndex}>
                  <CardHeader>
                    <CardTitle>{category.title}</CardTitle>
                  </CardHeader>
                  
                </Card>)}
            </div>}

          <Card className="mt-12">
            <CardHeader>
              <CardTitle>لم تجد إجابة لسؤالك؟</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                إذا لم تجد الإجابة التي تبحث عنها، فريق الدعم لدينا جاهز لمساعدتك
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button asChild className="flex-1">
                  <Link to="/contact">اتصل بنا</Link>
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <a href="https://wa.me/963999123456" target="_blank" rel="noreferrer">
                    تواصل عبر الواتساب
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>;
};
export default FAQ;