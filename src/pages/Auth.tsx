import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUp } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { Eye, EyeOff, Loader2, ShoppingBag } from "lucide-react";
import { z } from "zod";
import { COUNTRY_CODES, DEFAULT_COUNTRY, findCountry } from "@/lib/countryCodes";
import {
  CAPTCHA_AFTER,
  checkEmail,
  clearAttempts,
  getAttemptState,
  makeChallenge,
  recordFailedAttempt,
} from "@/lib/authGuard";

// Maps raw Supabase auth errors to clear Arabic messages
const authErrorMessageAr = (raw: string): string => {
  if (/known to be weak|pwned|weak and easy to guess/i.test(raw))
    return "كلمة المرور هذه مكشوفة في تسريبات معروفة وسهلة التخمين. اختر كلمة مرور أقوى وغير مستخدمة في مواقع أخرى.";
  if (/already registered|already been registered|user already exists/i.test(raw))
    return "هذا البريد الإلكتروني مسجّل مسبقاً. سجّل الدخول أو استخدم \"نسيت كلمة المرور؟\".";
  if (/invalid login credentials/i.test(raw)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (/email not confirmed/i.test(raw)) return "الحساب غير مفعّل، تحقق من بريدك الإلكتروني";
  if (/password should be at least/i.test(raw)) return "كلمة المرور قصيرة جداً";
  if (/rate limit|too many requests|over_email_send_rate_limit/i.test(raw))
    return "عدد المحاولات كبير، يرجى الانتظار قليلاً ثم المحاولة مجدداً";
  if (/invalid email/i.test(raw)) return "البريد الإلكتروني غير صالح";
  if (/signups not allowed|signup is disabled/i.test(raw)) return "التسجيل معطّل حالياً";
  return raw || "حدث خطأ، يرجى المحاولة مرة أخرى";
};

// Validation schemas
const signInSchema = z.object({
  email: z.string()
    .min(1, "البريد الإلكتروني مطلوب")
    .email("البريد الإلكتروني غير صالح"),
  password: z.string()
    .min(1, "كلمة المرور مطلوبة")
    .min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

const signUpSchema = z.object({
  fullName: z.string()
    .min(1, "الاسم الكامل مطلوب")
    .min(2, "الاسم يجب أن يكون حرفين على الأقل")
    .max(100, "الاسم طويل جداً"),
  email: z.string()
    .min(1, "البريد الإلكتروني مطلوب")
    .email("البريد الإلكتروني غير صالح"),
  password: z.string()
    .min(1, "كلمة المرور مطلوبة")
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    .regex(/[A-Z]/, "يجب أن تحتوي على حرف كبير واحد على الأقل")
    .regex(/[a-z]/, "يجب أن تحتوي على حرف صغير واحد على الأقل")
    .regex(/[0-9]/, "يجب أن تحتوي على رقم واحد على الأقل"),
  phone: z.string()
    .min(1, "رقم الهاتف مطلوب")
    .regex(/^\+[0-9]{7,17}$/, "رقم الهاتف غير صالح، تأكد من اختيار الدولة والرقم"),
  confirmPassword: z.string().min(1, "تأكيد كلمة المرور مطلوب"),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "يجب الموافقة على الشروط والأحكام" }),
  }),
}).refine((d) => d.password === d.confirmPassword, {
  path: ["confirmPassword"],
  message: "كلمتا المرور غير متطابقتين",
});

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Sign In State
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signInErrors, setSignInErrors] = useState<{ email?: string; password?: string }>({});
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [challenge, setChallenge] = useState(() => makeChallenge());
  const [captchaInput, setCaptchaInput] = useState("");
  const needsCaptcha = failedAttempts >= CAPTCHA_AFTER;

  // Restore throttle state and tick down any active lock
  useEffect(() => {
    const state = getAttemptState();
    setFailedAttempts(state.count);
    setLockSeconds(state.remainingLock);
  }, []);

  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setInterval(() => setLockSeconds((s) => (s > 1 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [lockSeconds]);

  // Sign Up State
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpFullName, setSignUpFullName] = useState("");
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [signUpErrors, setSignUpErrors] = useState<{ fullName?: string; email?: string; phone?: string; password?: string; confirmPassword?: string; acceptTerms?: string }>({});

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInErrors({});

    if (lockSeconds > 0) {
      toast({
        title: "تم إيقاف المحاولات مؤقتاً",
        description: `لأسباب أمنية، أعد المحاولة بعد ${lockSeconds} ثانية`,
        variant: "destructive",
      });
      return;
    }

    if (needsCaptcha && captchaInput.trim() !== challenge.answer) {
      setChallenge(makeChallenge());
      setCaptchaInput("");
      toast({
        title: "تحقق أمني غير صحيح",
        description: "أجب على العملية الحسابية بشكل صحيح للمتابعة",
        variant: "destructive",
      });
      return;
    }

    // Validate input
    const result = signInSchema.safeParse({
      email: signInEmail,
      password: signInPassword,
    });

    if (!result.success) {
      const errors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "email") errors.email = err.message;
        if (err.path[0] === "password") errors.password = err.message;
      });
      setSignInErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      // Tell the user clearly whether this email has an account before trying to sign in
      const check = await checkEmail(signInEmail);
      if (check.status === "not_registered") {
        setSignInErrors({ email: "لا يوجد حساب مرتبط بهذا البريد الإلكتروني" });
        toast({
          title: "بريد غير مسجّل",
          description: "لا يوجد حساب بهذا البريد. أنشئ حساباً جديداً أو تحقق من كتابة البريد.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      if (check.status === "registered" && check.confirmed === false) {
        toast({ title: "الحساب غير مفعّل", description: "سنرسل رمز تحقق جديد إلى بريدك" });
        navigate(`/verify-email?email=${encodeURIComponent(signInEmail)}`);
        setIsLoading(false);
        return;
      }

      const { user: signedInUser, error } = await signIn(signInEmail, signInPassword);

      if (error) throw error;

      // Check if user is banned
      if (signedInUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_banned, ban_reason")
          .eq("id", signedInUser.id)
          .single();

        if (profile?.is_banned) {
          // Sign out the banned user
          await supabase.auth.signOut();
          
          toast({
            title: "الحساب محظور",
            description: profile.ban_reason 
              ? `تم حظر حسابك بسبب: ${profile.ban_reason}`
              : "تم حظر حسابك. يرجى التواصل مع الدعم.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Log successful login
        await logActivity(signedInUser.id, "login");
      }

      clearAttempts();
      setFailedAttempts(0);
      setCaptchaInput("");
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحباً بعودتك!",
      });

      navigate("/");
    } catch (error) {
      const rawMsg = (error as Error)?.message || "";
      const attempt = recordFailedAttempt();
      setFailedAttempts(attempt.count);
      setChallenge(makeChallenge());
      setCaptchaInput("");
      if (attempt.lockedSeconds) {
        setFailedAttempts(0);
        setLockSeconds(attempt.lockedSeconds);
        toast({
          title: "محاولات كثيرة جداً",
          description: `تم إيقاف تسجيل الدخول مؤقتاً لمدة ${attempt.lockedSeconds} ثانية لحماية حسابك`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      if (/email not confirmed/i.test(rawMsg)) {
        toast({
          title: "الحساب غير مفعّل",
          description: "سنرسل رمز تحقق جديد إلى بريدك",
        });
        navigate(`/verify-email?email=${encodeURIComponent(signInEmail)}`);
        setIsLoading(false);
        return;
      }
      toast({
        title: "خطأ في تسجيل الدخول",
        description: authErrorMessageAr(rawMsg),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpErrors({});

    const fullPhone = `${findCountry(phoneCountry).dial}${phoneLocal.replace(/\D/g, "").replace(/^0+/, "")}`;

    // Validate input
    const result = signUpSchema.safeParse({
      fullName: signUpFullName,
      email: signUpEmail,
      phone: fullPhone,
      password: signUpPassword,
      confirmPassword: signUpConfirmPassword,
      acceptTerms: acceptTerms as true,
    });

    if (!result.success) {
      const errors: typeof signUpErrors = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "fullName") errors.fullName = err.message;
        if (err.path[0] === "email") errors.email = err.message;
        if (err.path[0] === "phone") errors.phone = err.message;
        if (err.path[0] === "password") errors.password = err.message;
        if (err.path[0] === "confirmPassword") errors.confirmPassword = err.message;
        if (err.path[0] === "acceptTerms") errors.acceptTerms = err.message;
      });
      setSignUpErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const { user: newUser, error } = await signUp(signUpEmail, signUpPassword, signUpFullName, fullPhone);

      if (error) throw error;

      // Supabase returns an obfuscated user with no identities when the email already exists
      if (newUser && Array.isArray(newUser.identities) && newUser.identities.length === 0) {
        toast({
          title: "البريد مسجّل مسبقاً",
          description: "هذا البريد الإلكتروني له حساب بالفعل. سجّل الدخول أو أعد تعيين كلمة المرور.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Notify admins about new user registration (best-effort)
      if (newUser) {
        try {
          await supabase.functions.invoke("notify-admin-new-user", {
            body: {
              user_id: newUser.id,
              user_email: signUpEmail,
              user_name: signUpFullName,
            },
          });
        } catch (notifyError) {
          console.error("Failed to notify admins:", notifyError);
        }
      }

      toast({
        title: "تم إنشاء الحساب",
        description: "أدخل رمز التحقق المرسل إلى بريدك لتفعيل حسابك",
      });

      navigate(`/verify-email?email=${encodeURIComponent(signUpEmail)}`);
    } catch (error) {
      const rawMsg = (error as Error)?.message || "";
      if (/already registered|already been registered|user already exists/i.test(rawMsg)) {
        setSignUpErrors((prev) => ({ ...prev, email: "هذا البريد الإلكتروني مسجّل مسبقاً" }));
      }
      toast({
        title: "خطأ في التسجيل",
        description: authErrorMessageAr(rawMsg),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            مرحباً بك
          </CardTitle>
          <CardDescription className="text-base">
            سجل الدخول أو أنشئ حساباً جديداً للبدء
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
              <TabsTrigger value="signup">حساب جديد</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">البريد الإلكتروني</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="example@email.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    disabled={isLoading}
                    className={signInErrors.email ? "border-destructive" : ""}
                  />
                  {signInErrors.email && (
                    <p className="text-sm text-destructive">{signInErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password">كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      disabled={isLoading}
                      className={`pl-20 ${signInErrors.password ? "border-destructive" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {signInErrors.password && (
                    <p className="text-sm text-destructive">{signInErrors.password}</p>
                  )}
                </div>

                <div className="text-left">
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 h-auto text-sm text-primary"
                    onClick={() => navigate("/forgot-password")}
                  >
                    نسيت كلمة المرور؟
                  </Button>
                </div>

                {needsCaptcha && lockSeconds === 0 && (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                    <Label htmlFor="captcha" className="text-sm">
                      تحقق أمني: كم ناتج {challenge.question}؟
                    </Label>
                    <Input
                      id="captcha"
                      inputMode="numeric"
                      dir="ltr"
                      placeholder="الإجابة"
                      value={captchaInput}
                      onChange={(e) => setCaptchaInput(e.target.value.replace(/\D/g, ""))}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      طُلب هذا التحقق بعد {failedAttempts} محاولات فاشلة لحماية حسابك.
                    </p>
                  </div>
                )}

                {lockSeconds > 0 && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="status">
                    تم إيقاف محاولات تسجيل الدخول مؤقتاً. يمكنك المحاولة مجدداً بعد {lockSeconds} ثانية.
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={isLoading || lockSeconds > 0}>
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري تسجيل الدخول...
                    </>
                  ) : lockSeconds > 0 ? (
                    `المحاولة متاحة بعد ${lockSeconds} ثانية`
                  ) : (
                    "تسجيل الدخول"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-fullname">الاسم الكامل</Label>
                  <Input
                    id="signup-fullname"
                    type="text"
                    placeholder="أدخل اسمك الكامل"
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    disabled={isLoading}
                    className={signUpErrors.fullName ? "border-destructive" : ""}
                  />
                  {signUpErrors.fullName && (
                    <p className="text-sm text-destructive">{signUpErrors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">البريد الإلكتروني</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="example@email.com"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    disabled={isLoading}
                    className={signUpErrors.email ? "border-destructive" : ""}
                  />
                  {signUpErrors.email && (
                    <p className="text-sm text-destructive">{signUpErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-phone">رقم الهاتف</Label>
                  <div className="flex gap-2" dir="ltr">
                    <Select value={phoneCountry} onValueChange={setPhoneCountry} disabled={isLoading}>
                      <SelectTrigger className="w-[130px] shrink-0" aria-label="مفتاح الدولة">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {COUNTRY_CODES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="flex items-center gap-2">
                              <span>{c.flag}</span>
                              <span className="font-mono">{c.dial}</span>
                              <span className="text-muted-foreground text-xs">{c.nameAr}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="signup-phone"
                      type="tel"
                      inputMode="tel"
                      dir="ltr"
                      placeholder="9XXXXXXXX"
                      value={phoneLocal}
                      onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d\s]/g, ""))}
                      disabled={isLoading}
                      className={`flex-1 ${signUpErrors.phone ? "border-destructive" : ""}`}
                    />
                  </div>
                  {signUpErrors.phone && (
                    <p className="text-sm text-destructive">{signUpErrors.phone}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      disabled={isLoading}
                      className={`pl-20 ${signUpErrors.password ? "border-destructive" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {signUpErrors.password && (
                    <p className="text-sm text-destructive">{signUpErrors.password}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    يجب أن تحتوي على 8 أحرف، حرف كبير، حرف صغير، ورقم
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">تأكيد كلمة المرور</Label>
                  <Input
                    id="signup-confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    className={signUpErrors.confirmPassword ? "border-destructive" : ""}
                  />
                  {signUpErrors.confirmPassword && (
                    <p className="text-sm text-destructive">{signUpErrors.confirmPassword}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="accept-terms"
                      checked={acceptTerms}
                      onCheckedChange={(v) => setAcceptTerms(v === true)}
                      disabled={isLoading}
                    />
                    <Label htmlFor="accept-terms" className="text-sm font-normal leading-5 cursor-pointer">
                      أوافق على{" "}
                      <a href="/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline">الشروط والأحكام</a>
                      {" "}و{" "}
                      <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary hover:underline">سياسة الخصوصية</a>
                    </Label>
                  </div>
                  {signUpErrors.acceptTerms && (
                    <p className="text-sm text-destructive">{signUpErrors.acceptTerms}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري إنشاء الحساب...
                    </>
                  ) : (
                    "إنشاء حساب"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  جميع الحسابات الجديدة تُنشأ كحساب مشتري. يمكنك فتح متجر لاحقاً من إعدادات حسابك.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
