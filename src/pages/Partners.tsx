import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake, TrendingUp, Users, Shield } from "lucide-react";

const Partners = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="bg-gradient-to-l from-primary/10 via-accent/10 to-primary/5 py-20">
          <div className="container px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">الشركاء</h1>
              <p className="text-lg text-muted-foreground">
                نبني شراكات استراتيجية لتقديم أفضل خدمة لعملائنا
              </p>
            </div>
          </div>
        </div>

        <div className="container px-4 py-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Handshake className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">شراكات استراتيجية</h3>
                  <p className="text-muted-foreground">نعمل مع أفضل الشركات المحلية والإقليمية</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">نمو مشترك</h3>
                  <p className="text-muted-foreground">نحقق النجاح معاً من خلال التعاون</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">شبكة واسعة</h3>
                  <p className="text-muted-foreground">أكثر من 50 شريك في مختلف المجالات</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">موثوقية</h3>
                  <p className="text-muted-foreground">شركاء معتمدون بأعلى معايير الجودة</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold mb-6">شركاؤنا</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Card key={i} className="hover:shadow-lg transition-shadow">
                      <CardContent className="flex items-center justify-center p-6">
                        <div className="w-full h-20 bg-muted rounded flex items-center justify-center">
                          <span className="text-muted-foreground">شريك {i}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold mb-6">أنواع الشراكات</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>شركاء الشحن</CardTitle>
                      <CardDescription>شركات الشحن والتوصيل المعتمدة</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        نعمل مع أفضل شركات الشحن لضمان وصول المنتجات بأمان وفي الوقت المحدد
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>شركاء الدفع</CardTitle>
                      <CardDescription>بوابات الدفع الإلكتروني</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        شراكات مع أهم بوابات الدفع المحلية لتوفير خيارات دفع آمنة ومتنوعة
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>الموردون</CardTitle>
                      <CardDescription>موردو المنتجات المعتمدون</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        شبكة واسعة من الموردين الموثوقين في مختلف فئات المنتجات
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>شركاء التكنولوجيا</CardTitle>
                      <CardDescription>مزودو الحلول التقنية</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        نستخدم أحدث التقنيات من شركائنا لتقديم أفضل تجربة مستخدم
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>كن شريكاً</CardTitle>
                  <CardDescription>هل ترغب في التعاون معنا؟</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    نرحب بالشراكات الاستراتيجية التي تضيف قيمة لعملائنا ومجتمعنا. إذا كنت تمتلك خدمة أو منتج 
                    يمكن أن يساهم في تحسين تجربة التسوق الإلكتروني، نود سماع أفكارك.
                  </p>
                  <Button>تواصل معنا</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Partners;
