import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingBag, MailCheck } from "lucide-react";

const RESEND_COOLDOWN = 60;
const EXPIRY_SECONDS = 600;

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const emailParam = params.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(EXPIRY_SECONDS);
  const autoResentRef = useRef(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const t = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
      setExpiresIn((e) => (e > 0 ? e - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const triggerResend = async (silent = false) => {
    if (!email) {
      if (!silent) toast({ title: "أدخل البريد الإلكتروني", variant: "destructive" });
      return;
    }
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setResendCooldown(RESEND_COOLDOWN);
      setExpiresIn(EXPIRY_SECONDS);
      if (!silent) toast({ title: "تم إرسال رمز جديد", description: "تحقق من بريدك الإلكتروني" });
    } catch (err) {
      const msg = (err as Error)?.message || "";
      if (/already/i.test(msg)) {
        toast({ title: "الحساب مفعّل مسبقاً", description: "يمكنك تسجيل الدخول" });
        navigate("/auth");
        return;
      }
      if (!silent) toast({ title: "تعذّر إرسال الرمز", description: msg, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (emailParam && !autoResentRef.current) {
      autoResentRef.current = true;
      triggerResend(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailParam]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast({ title: "الرمز يجب أن يتكون من 6 أرقام", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      toast({ title: "تم تفعيل الحساب بنجاح", description: "مرحباً بك!" });
      navigate("/");
    } catch (err) {
      const msg = (err as Error)?.message || "";
      let description = "الرمز غير صحيح أو منتهي الصلاحية";
      if (/expired/i.test(msg)) description = "انتهت صلاحية الرمز، أعد الإرسال";
      toast({ title: "فشل التحقق", description, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const mm = String(Math.floor(expiresIn / 60)).padStart(2, "0");
  const ss = String(expiresIn % 60).padStart(2, "0");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
              <MailCheck className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">تحقق من بريدك الإلكتروني</CardTitle>
          <CardDescription>
            أرسلنا رمزاً مكوّناً من 6 أرقام إلى بريدك، أدخله لتفعيل الحساب
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify-email">البريد الإلكتروني</Label>
              <Input
                id="verify-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || !!emailParam}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="otp">رمز التحقق</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground text-center">
                {expiresIn > 0
                  ? `صالح لمدة ${mm}:${ss}`
                  : "انتهت صلاحية الرمز، اضغط إعادة الإرسال"}
              </p>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading || code.length !== 6}>
              {loading ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري التحقق...</>
              ) : (
                "تفعيل الحساب"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={resendCooldown > 0}
              onClick={() => triggerResend(false)}
            >
              {resendCooldown > 0 ? `إعادة الإرسال بعد ${resendCooldown}s` : "إعادة إرسال الرمز"}
            </Button>
            <Button
              type="button"
              variant="link"
              className="w-full"
              onClick={() => navigate("/auth")}
            >
              العودة إلى تسجيل الدخول
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;