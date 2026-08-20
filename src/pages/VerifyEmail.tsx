import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MailCheck, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { checkEmail } from "@/lib/authGuard";

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
  const [sendState, setSendState] = useState<"idle" | "checking" | "sending" | "sent" | "error">("idle");
  const [sendMessage, setSendMessage] = useState("");
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

    // Verify the email belongs to an account (and is not already active) first
    setSendState("checking");
    setSendMessage("جاري التحقق من البريد الإلكتروني...");
    const check = await checkEmail(email);
    if (check.status === "not_registered") {
      setSendState("error");
      setSendMessage("لا يوجد حساب مرتبط بهذا البريد الإلكتروني، أنشئ حساباً جديداً");
      if (!silent) toast({ title: "بريد غير مسجّل", description: check.messageAr, variant: "destructive" });
      return;
    }
    if (check.status === "invalid" || check.status === "rate_limited") {
      setSendState("error");
      setSendMessage(check.messageAr);
      if (!silent) toast({ title: "تعذّر الإرسال", description: check.messageAr, variant: "destructive" });
      return;
    }
    if (check.status === "registered" && check.confirmed) {
      setSendState("error");
      setSendMessage("هذا الحساب مفعّل مسبقاً، يمكنك تسجيل الدخول مباشرة");
      toast({ title: "الحساب مفعّل مسبقاً", description: "يمكنك تسجيل الدخول" });
      navigate("/auth");
      return;
    }

    try {
      setSendState("sending");
      setSendMessage("جاري إرسال رمز التحقق إلى بريدك...");
      const { error } = await supabase.auth.resend({ type: "signup", email });
      if (error) throw error;
      setResendCooldown(RESEND_COOLDOWN);
      setExpiresIn(EXPIRY_SECONDS);
      setSendState("sent");
      setSendMessage(`تم إرسال رمز مكوّن من 6 أرقام إلى ${email}. تحقق من صندوق الوارد وأيضاً مجلد الرسائل غير المرغوب فيها.`);
      if (!silent) toast({ title: "تم إرسال رمز جديد", description: "تحقق من بريدك الإلكتروني" });
    } catch (err) {
      const msg = (err as Error)?.message || "";
      setSendState("error");
      setSendMessage(
        /rate limit|too many/i.test(msg)
          ? "عدد المحاولات كبير، انتظر دقيقة ثم أعد الإرسال"
          : "تعذّر إرسال رمز التحقق، حاول مرة أخرى"
      );
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
      // If this account has a pending seller application, route to it.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: app } = await supabase
          .from("seller_applications")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (app) { navigate("/seller/application"); return; }
      }
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
  const busy = sendState === "checking" || sendState === "sending";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
              <MailCheck className="w-8 h-8 text-primary-foreground" />
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

            {sendMessage && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  sendState === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : sendState === "sent"
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-muted/50 text-muted-foreground"
                }`}
                role="status"
                aria-live="polite"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 mt-0.5 animate-spin shrink-0" />
                ) : sendState === "error" ? (
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                )}
                <span>{sendMessage}</span>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading || code.length !== 6}>
              {loading ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري التحقق...</>
              ) : (
                "تفعيل الحساب"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={resendCooldown > 0 || busy}
              onClick={() => triggerResend(false)}
            >
              {busy ? (
                <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الإرسال...</>
              ) : resendCooldown > 0 ? (
                `إعادة الإرسال متاحة بعد ${resendCooldown} ثانية`
              ) : (
                <><Send className="ml-2 h-4 w-4" /> إعادة إرسال الرمز</>
              )}
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