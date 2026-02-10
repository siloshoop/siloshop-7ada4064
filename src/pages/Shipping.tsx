import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Package, Clock, MapPin } from "lucide-react";
const Shipping = () => {
  return <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">الشحن والتوصيل</h1>
            <p className="text-muted-foreground text-lg">معلومات مفصلة عن خدمة التوصيل</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <Truck className="h-8 w-8 text-primary mb-2" />
                <CardTitle>توصيل سريع</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">توصيل خلال 2-5 أيام عمل لجميع المحافظات السورية</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Package className="h-8 w-8 text-primary mb-2" />
                <CardTitle>تغليف آمن</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">نضمن وصول منتجاتك بحالة ممتازة مع تغليف محترف</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Clock className="h-8 w-8 text-primary mb-2" />
                <CardTitle>تتبع الطلب</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">تتبع طلبك لحظة بلحظة من خلال رقم التتبع</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <MapPin className="h-8 w-8 text-primary mb-2" />
                <CardTitle>تغطية شاملة</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">نوصل إلى جميع المحافظات والمدن السورية</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>مدة التوصيل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span>دمشق وريفها</span>
                  <span className="font-semibold">2-3 أيام عمل</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b">
                  <span>المدن الرئيسية (حلب، حمص، اللاذقية، طرطوس)</span>
                  <span className="font-semibold">3-4 أيام عمل</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>المحافظات الأخرى</span>
                  <span className="font-semibold">4-5 أيام عمل</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>تكلفة الشحن</CardTitle>
              </CardHeader>
              
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>شروط التوصيل</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p>• يجب التأكد من صحة العنوان ورقم الهاتف عند إتمام الطلب</p>
                <p>• سيتم التواصل معك قبل التوصيل لتحديد موعد مناسب</p>
                <p>• يجب فحص المنتج قبل استلامه والتأكد من سلامته</p>
                <p>• في حالة الدفع عند الاستلام، يجب تحضير المبلغ المطلوب بالضبط</p>
                <p>• يمكن إعادة جدولة التوصيل مرة واحدة مجاناً</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>معلومات إضافية</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  نعمل مع أفضل شركات الشحن لضمان وصول طلباتك في الوقت المحدد وبأفضل حالة. 
                  في حالة وجود أي تأخير، سيتم إبلاغك فوراً عبر الرسائل النصية والبريد الإلكتروني.
                </p>
                <p className="font-semibold">للاستفسارات حول الشحن:</p>
                <p>البريد الإلكتروني: shipping@marketplace.sy</p>
                <p>الهاتف: +963 11 123 4567</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>;
};
export default Shipping;