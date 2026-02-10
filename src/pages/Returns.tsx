import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
const Returns = () => {
  return <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">سياسة الإرجاع والاستبدال</h1>
            <p className="text-muted-foreground text-lg">نضمن لك تجربة تسوق آمنة ومريحة</p>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>شروط الإرجاع</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p>يمكن إرجاع المنتجات خلال 14 يوماً من تاريخ الاستلام</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p>يجب أن يكون المنتج في حالته الأصلية مع العبوة والملحقات</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p>يجب أن يكون المنتج غير مستخدم وغير تالف</p>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p>يجب الاحتفاظ بفاتورة الشراء الأصلية</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>المنتجات غير القابلة للإرجاع</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>• المنتجات الشخصية والنظافة</p>
                <p>• المنتجات الغذائية والمشروبات</p>
                <p>• البرمجيات والمنتجات الرقمية</p>
                <p>• المنتجات المخصصة حسب الطلب</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>خطوات الإرجاع</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">1. تقديم طلب الإرجاع</h3>
                  <p className="text-muted-foreground">تواصل مع خدمة العملاء عبر الهاتف أو البريد الإلكتروني</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2. تأكيد الطلب</h3>
                  <p className="text-muted-foreground">سيتم مراجعة طلبك وتزويدك برقم إرجاع</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">3. إرسال المنتج</h3>
                  <p className="text-muted-foreground">قم بتغليف المنتج بشكل آمن وإرساله إلى عنواننا</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">4. استرداد المبلغ</h3>
                  <p className="text-muted-foreground">سيتم استرداد المبلغ خلال 7-14 يوم عمل</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>سياسة الاستبدال</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  في حال وجود عيب في المنتج أو عدم مطابقته للمواصفات، يمكنك استبداله بمنتج مماثل أو آخر من نفس القيمة. 
                  نتحمل تكاليف الشحن في حالة العيوب المصنعية فقط.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>للتواصل</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2">للاستفسارات حول الإرجاع والاستبدال:</p>
                <p>البريد الإلكتروني: returns@marketplace.sy</p>
                
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>;
};
export default Returns;