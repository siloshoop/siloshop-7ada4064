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
            <h1 className="text-4xl font-bold mb-4">سياسة الإرجاع</h1>
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
                  <p>يمكن طلب إرجاع المنتجات خلال 7 أيام من تاريخ الاستلام</p>
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
                  
                  
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مراحل طلب الإرجاع</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  قيد المراجعة الأولية ← قيد المراجعة ← موافقة أو رفض ← بانتظار إرجاع المنتج ← تم إرسال
                  المنتج ← تم استلام المنتج ← قيد الفحص ← تم إكمال الإرجاع. لا تتوفر خدمة الاستبدال حالياً؛
                  يمكنك طلب الإرجاع فقط.
                </p>
              </CardContent>
            </Card>

            <Card>
              
              
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>;
};
export default Returns;