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
const ISSUED_KEY = "siloshop_otp_issued_at";

// The provider keeps only the most recent code per email: remember when the
// newest one was issued so the countdown survives a page refresh and always
// describes the code the user actually has.
const readIssuedAt = (email: string): number | null => {
  try {
    const raw = sessionStorage.getItem(ISSUED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string; at?: number };
    if (!parsed?.at || (parsed.email || "") !== email) return null;
    return parsed.at;
  } catch {
    return null;
  }
};

const writeIssuedAt = (email: string, at: number) => {
  try {
    sessionStorage.setItem(ISSUED_KEY, JSON.stringify({ email, at }));
  } catch {
    /* storage unavailable */
  }
};

const remainingFrom = (at: number | null) => {
  if (!at) return EXPIRY_SECONDS;
  return Math.max(0, EXPIRY_SECONDS - Math.floor((Date.now() - at) / 1000));
};

const VerifyEmail = () => {
  const [params] = useSearchParams();
  const emailParam = params.get("email") || "";
  const justSignedUp = params.get("sent") === "1";
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(() => remainingFrom(readIssuedAt(emailParam)));
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
      writeIssuedAt(email, Date.now());
      setExpiresIn(EXPIRY_SECONDS);
      setCode("");
      setSendState("sent");
      setSendMessage(`تم إرسال رمز مكوّن من 6 أرقام إلى ${email}. تحقق من صندوق الوارد وأيضاً مجلد الرسائل غير المرغوب فيها.`);
      if (!silent) toast({ title: "تم إرسال رمز جديد", description: "تحقق من بريدك الإلكتروني" });
    } catch (err) {
      const msg = (err as Error)?.message || "";
      if (/already/i.test(msg) && !/rate limit|only request this/i.test(msg)) {
        setSendState("error");
        setSendMessage("هذا الحساب مفعّل مسبقاً، يمكنك تسجيل الدخول مباشرة");
        toast({ title: "الحساب مفعّل مسبقاً", description: "يمكنك تسجيل الدخول" });
        navigate("/auth");
        return;
      }
      // A provider rate limit means a code was just sent — that is not a failure.
      if (/rate limit|too many|only request this/i.test(msg)) {
        const wait = Number(msg.match(/after (\d+) second/)?.[1] ?? RESEND_COOLDOWN);
        setResendCooldown(wait);
        setSendState("sent");
        setSendMessage(
          `تم إرسال رمز التحقق إلى ${email} مسبقاً. تحقق من صندوق الوارد ومجلد الرسائل غير المرغوب فيها، ويمكنك إعادة الإرسال بعد ${wait} ثانية.`,
        );
        if (!silent) {
          toast({ title: "الرمز مُرسل بالفعل", description: "تحقق من بريدك الإلكتروني" });
        }
        return;
      }
      setSendState("error");
      setSendMessage("تعذّر إرسال رمز التحقق، حاول مرة أخرى");
      if (!silent) toast({ title: "تعذّر إرسال الرمز", description: msg, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!emailParam || autoResentRef.current) return;
    autoResentRef.current = true;
    if (justSignedUp) {
      // Sign-up already delivered the code; a second send would only hit the
      // provider rate limit and show a false error.
      setResendCooldown(RESEND_COOLDOWN);
      const issuedAt = readIssuedAt(emailParam);
      if (!issuedAt) writeIssuedAt(emailParam, Date.now());
      setExpiresIn(remainingFrom(issuedAt ?? Date.now()));
      setSendState("sent");
      setSendMessage(
        `تم إرسال رمز مكوّن من 6 أرقام إلى ${emailParam}. تحقق من صندوق الوارد وأيضاً مجلد الرسائل غير المرغوب فيها.`,
      );
      return;
    }
    triggerResend(true);
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
      // Sign-up confirmation codes are accepted under both `email` and `signup`
      // depending on how the account was created; try the second before failing.
      let { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
      if (error) {
        const retry = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: "signup" });
        if (!retry.error) error = null;
      }
      if (error) throw error;
      writeIssuedAt(email, 0);
      toast({ title: "تم تفعيل الحساب بنجاح", description: "مرحباً بك!" });
      // If this account has a pending seller application, route to it.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Admins are notified here (not at sign-up): only now does the caller
        // hold a session, which the edge function requires.
        try {
          await supabase.functions.invoke("notify-admin-new-user", {
            body: {
              user_id: user.id,
              user_email: user.email,
              user_name: (user.user_metadata?.full_name as string) || user.email,
            },
          });
        } catch {
          /* best-effort */
        }
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