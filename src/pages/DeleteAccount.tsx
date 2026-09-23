import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ShieldAlert, Trash2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "البريد الإلكتروني مطلوب")
    .email("البريد الإلكتروني غير صالح")
    .max(255, "البريد يجب أن يكون أقل من 255 حرف"),
  phone: z
    .string()
    .trim()
    .max(20, "رقم الهاتف يجب أن يكون أقل من 20 رقم")
    .optional(),
});

const DELETED_DATA = [
  "الحساب وبيانات تسجيل الدخول (البريد الإلكتروني ورقم الهاتف وكلمة المرور)",
  "الملف الشخصي: الاسم وصورة الحساب والعناوين المحفوظة",
  "السلة وقائمة المفضلة وقائمة المقارنة وسجل المشاهدات والبحث",
  "التقييمات والمراجعات والأسئلة والردود المرتبطة بحسابك",
  "محادثات الدردشة مع البائعين والمرفقات الخاصة بها",
  "إعدادات الإشعارات والاشتراك في النشرة البريدية",
];

const RETAINED_DATA = [
  "سجلات الطلبات والفواتير: تُحفظ مدة 10 سنوات للالتزامات المحاسبية والقانونية، وتُفصل عن هويتك بعد حذف الحساب.",
  "سجلات مكافحة الاحتيال والمخالفات: تُحفظ حتى 12 شهرًا.",
  "النسخ الاحتياطية المشفّرة: تُحذف تلقائيًا خلال 30 يومًا.",
];

const DeleteAccount = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ email: "", phone: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = schema.parse(form);
      const { error } = await supabase.from("account_deletion_requests").insert([
        {
          email: data.email,
          phone: data.phone && data.phone.length > 0 ? data.phone : null,
        },
      ]);
      if (error) {
        if (error.message?.includes("deletion_request_rate_limited")) {
          toast({
            title: "تم تجاوز الحد المسموح",
            description: "أرسلت عدة طلبات مؤخرًا. يرجى الانتظار ساعة قبل المحاولة مرة أخرى.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      setSubmitted(true);
      setForm({ email: "", phone: "" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "خطأ في البيانات",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8 md:py-12">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 text-destructive">
              <Trash2 className="w-7 h-7" />
            </div>
            <h1 className="text-2xl md:text-4xl font-bold break-safe">حذف حساب SiloShop</h1>
            <p className="text-muted-foreground text-sm md:text-base break-safe">
              يمكنك طلب حذف حسابك وبياناتك الشخصية من SiloShop دون الحاجة إلى تسجيل الدخول.
              أرسل بريدك الإلكتروني المسجّل في النموذج أدناه وسنعالج الطلب ونؤكده عبر البريد.
            </p>
          </div>

          {submitted ? (
            <Card data-testid="deletion-confirmation">
              <CardContent className="pt-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
                <h2 className="text-xl font-semibold">تم استلام طلب الحذف</h2>
                <p className="text-muted-foreground text-sm break-safe">
                  سنراجع طلبك ونحذف الحساب والبيانات المرتبطة به خلال 30 يومًا كحد أقصى،
                  وسنرسل تأكيدًا إلى بريدك الإلكتروني عند إتمام الحذف.
                </p>
                <Button variant="outline" onClick={() => setSubmitted(false)}>
                  إرسال طلب آخر
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">نموذج طلب الحذف</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="email">البريد الإلكتروني للحساب *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      dir="ltr"
                      required
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">رقم الهاتف (اختياري)</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      dir="ltr"
                      placeholder="+963 9XX XXX XXX"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "جارٍ الإرسال..." : "إرسال طلب الحذف"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-6 flex gap-3 items-start text-sm">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
              <p className="break-safe">
              حذف الحساب نهائي ولا يمكن التراجع عنه. إذا كنت مسجّل الدخول، يمكنك أيضًا حذف حسابك
              فورًا من <Link to="/profile" className="text-primary hover:underline">إعدادات الحساب</Link>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">البيانات التي سيتم حذفها</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc ps-5 space-y-2 text-sm text-muted-foreground break-safe">
                {DELETED_DATA.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">البيانات التي يتم الاحتفاظ بها ومدّتها</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc ps-5 space-y-2 text-sm text-muted-foreground break-safe">
                {RETAINED_DATA.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground mt-4 break-safe">
                لمزيد من التفاصيل حول كيفية معالجة بياناتك، راجع{" "}
                <Link to="/privacy" className="text-primary hover:underline">سياسة الخصوصية</Link>.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default DeleteAccount;
