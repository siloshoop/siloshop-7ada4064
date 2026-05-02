import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Download, Smartphone, CheckCircle } from "lucide-react";

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              ثبّت تطبيق{" "}
              <span className="font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tracking-tight">
                SiloShop
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              احصل على تجربة تسوق أفضل مع تطبيقنا القابل للتثبيت
            </p>
          </div>

          {isInstalled ? (
            <Card className="p-8 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">التطبيق مثبت بنجاح!</h2>
              <p className="text-muted-foreground">
                يمكنك الآن استخدام التطبيق من شاشتك الرئيسية
              </p>
            </Card>
          ) : (
            <>
              <Card className="p-8 mb-6">
                <div className="flex items-center gap-4 mb-6">
                  <Smartphone className="h-12 w-12 text-primary" />
                  <div>
                    <h2 className="text-2xl font-bold mb-2">لماذا تثبيت التطبيق؟</h2>
                    <p className="text-muted-foreground">
                      استمتع بتجربة استخدام محسّنة وأسرع
                    </p>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <span>الوصول السريع من الشاشة الرئيسية</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <span>يعمل بدون اتصال بالإنترنت</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <span>إشعارات فورية للعروض والطلبات</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <span>تحميل أسرع وأداء محسّن</span>
                  </li>
                </ul>

                {deferredPrompt ? (
                  <Button onClick={handleInstall} size="lg" className="w-full">
                    <Download className="ml-2 h-5 w-5" />
                    تثبيت التطبيق الآن
                  </Button>
                ) : (
                  <div className="text-center">
                    <p className="text-muted-foreground mb-4">
                      لتثبيت التطبيق على جهازك:
                    </p>
                    <div className="space-y-2 text-sm">
                      <p><strong>على iPhone:</strong> اضغط على أيقونة المشاركة ثم "إضافة إلى الشاشة الرئيسية"</p>
                      <p><strong>على Android:</strong> افتح قائمة المتصفح واختر "إضافة إلى الشاشة الرئيسية"</p>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="font-bold mb-4">الميزات الإضافية</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">💬 دردشة مباشرة</h4>
                    <p className="text-sm text-muted-foreground">
                      تواصل مع البائعين مباشرةً
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">💳 دفع آمن</h4>
                    <p className="text-sm text-muted-foreground">
                      خيارات دفع متعددة
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">📦 تتبع الطلبات</h4>
                    <p className="text-sm text-muted-foreground">
                      راقب طلباتك لحظة بلحظة
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">⭐ التقييمات</h4>
                    <p className="text-sm text-muted-foreground">
                      اطلع على آراء العملاء
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default InstallPWA;
