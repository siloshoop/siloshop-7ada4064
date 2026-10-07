import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake, TrendingUp, Users, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveStoreAssetUrl } from "@/lib/storeAssets";

interface PartnerItem { id: string; name: string; logo_url: string | null; website_url: string | null }

const Partners = () => {
  const [partners, setPartners] = useState<PartnerItem[] | null>(null);
  useEffect(() => {
    void supabase
      .from("partners")
      .select("id,name,logo_url,website_url")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at")
      .then(({ data }) => setPartners((data as PartnerItem[]) ?? []));
  }, []);
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
                  {partners === null ? null : partners.length === 0 ? (
                    <p className="col-span-full text-center text-muted-foreground">سيتم الإعلان عن شركائنا قريبًا</p>
                  ) : partners.map((p) => {
                    const logo = p.logo_url ? resolveStoreAssetUrl(p.logo_url) : null;
                    const body = (
                      <Card className="h-full hover:shadow-lg transition-shadow">
                        <CardContent className="flex flex-col items-center justify-center gap-2 p-4">
                          <div className="w-full h-20 flex items-center justify-center overflow-hidden rounded">
                            {logo ? <img src={logo} alt={p.name} loading="lazy" className="max-h-full max-w-full object-contain" /> : <span className="font-semibold">{p.name}</span>}
                          </div>
                          {logo && <span className="text-center text-sm text-muted-foreground line-clamp-1">{p.name}</span>}
                        </CardContent>
                      </Card>
                    );
                    return p.website_url ? (
                      <a key={p.id} href={p.website_url} target="_blank" rel="noopener noreferrer">{body}</a>
                    ) : <div key={p.id}>{body}</div>;
                  })}
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
                  <Button asChild><Link to="/contact">تواصل معنا</Link></Button>
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
