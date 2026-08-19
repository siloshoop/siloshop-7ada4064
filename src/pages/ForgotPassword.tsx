import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Loader2, Mail, ShoppingBag } from "lucide-react";
import { checkEmail } from "@/lib/authGuard";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال البريد الإلكتروني", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const check = await checkEmail(email);
      if (check.status === "not_registered") {
        toast({
          title: "بريد غير مسجّل",
          description: "لا يوجد حساب مرتبط بهذا البريد الإلكتروني، تأكد من كتابته أو أنشئ حساباً جديداً",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      if (check.status === "invalid" || check.status === "rate_limited") {
        toast({ title: "تعذّر الإرسال", description: check.messageAr, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "تم الإرسال", description: "تحقق من بريدك الإلكتروني لإعادة تعيين كلمة المرور" });
    } catch (error) {
      const raw = (error as Error)?.message || "";
      const description = /rate limit|too many|over_email_send/i.test(raw)
        ? "عدد المحاولات كبير، انتظر دقيقة ثم أعد المحاولة"
        : /invalid email/i.test(raw)
          ? "البريد الإلكتروني غير صالح"
          : raw || "تعذّر إرسال الرابط، حاول مرة أخرى";
      toast({ title: "خطأ", description, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border/50 shadow-2xl bg-card/80 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-primary/60 rounded-2xl flex items-center justify-center shadow-lg">
            <ShoppingBag className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {sent ? "تحقق من بريدك" : "نسيت كلمة المرور"}
          </CardTitle>
          <CardDescription>
            {sent
              ? "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني"
              : "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-10 w-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                إذا لم تجد الرسالة، تحقق من مجلد الرسائل غير المرغوب فيها
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                <ArrowRight className="h-4 w-4 ml-2" />
                العودة لتسجيل الدخول
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    جاري الإرسال...
                  </>
                ) : (
                  "إرسال رابط إعادة التعيين"
                )}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate("/auth")}>
                <ArrowRight className="h-4 w-4 ml-2" />
                العودة لتسجيل الدخول
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
