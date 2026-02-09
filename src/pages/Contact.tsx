import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin, Send, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useRateLimit } from "@/hooks/useRateLimit";
const contactSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(100, "الاسم يجب أن يكون أقل من 100 حرف"),
  email: z.string().trim().email("البريد الإلكتروني غير صالح").max(255, "البريد يجب أن يكون أقل من 255 حرف"),
  phone: z.string().trim().min(1, "رقم الهاتف مطلوب").max(20, "رقم الهاتف يجب أن يكون أقل من 20 رقم"),
  subject: z.string().trim().min(1, "الموضوع مطلوب").max(200, "الموضوع يجب أن يكون أقل من 200 حرف"),
  message: z.string().trim().min(10, "الرسالة يجب أن تكون 10 أحرف على الأقل").max(2000, "الرسالة يجب أن تكون أقل من 2000 حرف")
});
const Contact = () => {
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const {
    checkRateLimit,
    recordSubmission,
    isChecking
  } = useRateLimit();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const validated = contactSchema.parse(formData);

      // Check rate limit before submission
      const canSubmit = await checkRateLimit(validated.email);
      if (!canSubmit) {
        toast({
          title: "تم تجاوز الحد المسموح",
          description: "لقد أرسلت عدة رسائل مؤخراً. يرجى الانتظار ساعة قبل المحاولة مرة أخرى.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      const {
        error
      } = await supabase.from("contact_messages").insert([{
        name: validated.name,
        email: validated.email,
        phone: validated.phone,
        subject: validated.subject,
        message: validated.message
      }]);
      if (error) throw error;

      // Record submission for rate limiting
      await recordSubmission(validated.email);
      toast({
        title: "تم إرسال رسالتك بنجاح",
        description: "سنتواصل معك في أقرب وقت ممكن"
      });
      setFormData({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: ""
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "خطأ في البيانات",
          description: error.errors[0].message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء إرسال الرسالة، يرجى المحاولة مرة أخرى",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">اتصل بنا</h1>
            <p className="text-muted-foreground text-lg">
              نحن هنا لمساعدتك! لا تتردد في التواصل معنا
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
            <Card>
              
              
            </Card>

            <Card>
              <CardHeader>
                <Mail className="h-8 w-8 text-primary mb-2" />
                <CardTitle>البريد الإلكتروني</CardTitle>
              </CardHeader>
              
            </Card>

            <Card>
              <CardHeader>
                <MapPin className="h-8 w-8 text-primary mb-2" />
                <CardTitle>العنوان</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">دمشق - المزة</p>
                <p className="text-muted-foreground">شارع الجلاء - مبنى 15</p>
                <p className="text-sm text-muted-foreground mt-2">
                  الطابق الثاني - مكتب 204
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                أرسل لنا رسالة
                <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                يمكنك إرسال 3 رسائل كحد أقصى في الساعة
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      الاسم الكامل *
                    </label>
                    <Input required maxLength={100} value={formData.name} onChange={e => setFormData({
                    ...formData,
                    name: e.target.value
                  })} placeholder="أدخل اسمك الكامل" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      البريد الإلكتروني *
                    </label>
                    <Input type="email" required maxLength={255} value={formData.email} onChange={e => setFormData({
                    ...formData,
                    email: e.target.value
                  })} placeholder="example@email.com" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      رقم الهاتف *
                    </label>
                    <Input type="tel" required maxLength={20} value={formData.phone} onChange={e => setFormData({
                    ...formData,
                    phone: e.target.value
                  })} placeholder="+963 XXX XXX XXX" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      الموضوع *
                    </label>
                    <Input required maxLength={200} value={formData.subject} onChange={e => setFormData({
                    ...formData,
                    subject: e.target.value
                  })} placeholder="موضوع الرسالة" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    الرسالة *
                  </label>
                  <Textarea required minLength={10} maxLength={2000} value={formData.message} onChange={e => setFormData({
                  ...formData,
                  message: e.target.value
                })} placeholder="اكتب رسالتك هنا..." className="min-h-[150px]" />
                  <p className="text-sm text-muted-foreground mt-1">
                    {formData.message.length} / 2000 حرف
                  </p>
                </div>

                <Button type="submit" disabled={loading || isChecking} className="w-full">
                  {loading || isChecking ? "جاري الإرسال..." : <>
                      <Send className="ml-2 h-4 w-4" />
                      إرسال الرسالة
                    </>}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>طرق التواصل البديلة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">الدعم الفني</h3>
                <p className="text-muted-foreground">
                  للمساعدة الفورية، يمكنك التواصل مع فريق الدعم الفني عبر الواتساب
                  على الرقم +963 999 123 456
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">حسابات التواصل الاجتماعي</h3>
                <p className="text-muted-foreground">
                  تابعنا على فيسبوك وإنستغرام وتويتر للحصول على آخر العروض والأخبار
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">مواعيد العمل</h3>
                <p className="text-muted-foreground">
                  السبت - الخميس: 9:00 صباحاً - 8:00 مساءً
                  <br />
                  الجمعة: عطلة رسمية
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>;
};
export default Contact;