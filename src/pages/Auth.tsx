import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUp } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/hooks/useActivityLog";
import { Eye, EyeOff, Loader2, ShoppingBag } from "lucide-react";
import { z } from "zod";

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
  role: z.enum(["customer", "vendor"], {
    errorMap: () => ({ message: "يرجى اختيار نوع الحساب" }),
  }),
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

  // Sign Up State
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpRole, setSignUpRole] = useState<'customer' | 'vendor'>('customer');
  const [signUpErrors, setSignUpErrors] = useState<{ fullName?: string; email?: string; password?: string; role?: string }>({});

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInErrors({});

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

      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحباً بعودتك!",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpErrors({});

    // Validate input
    const result = signUpSchema.safeParse({
      fullName: signUpFullName,
      email: signUpEmail,
      password: signUpPassword,
      role: signUpRole,
    });

    if (!result.success) {
      const errors: { fullName?: string; email?: string; password?: string; role?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "fullName") errors.fullName = err.message;
        if (err.path[0] === "email") errors.email = err.message;
        if (err.path[0] === "password") errors.password = err.message;
        if (err.path[0] === "role") errors.role = err.message;
      });
      setSignUpErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const { user: newUser, error } = await signUp(signUpEmail, signUpPassword, signUpFullName, signUpRole);

      if (error) throw error;

      // Log signup activity and notify admins
      if (newUser) {
        await logActivity(newUser.id, "signup", { role: signUpRole });
        
        // Notify admins about new user registration
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
        title: "تم إنشاء الحساب بنجاح",
        description: "مرحباً بك في منصتنا!",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "خطأ في التسجيل",
        description: error.message,
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
              <ShoppingBag className="w-8 h-8 text-white" />
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

                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري تسجيل الدخول...
                    </>
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

                <div className="space-y-3">
                  <Label>نوع الحساب</Label>
                  <RadioGroup value={signUpRole} onValueChange={(value: 'customer' | 'vendor') => setSignUpRole(value)}>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="customer" id="customer" />
                      <Label htmlFor="customer" className="cursor-pointer">
                        عميل - أريد الشراء من المنصة
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value="vendor" id="vendor" />
                      <Label htmlFor="vendor" className="cursor-pointer">
                        بائع - أريد بيع المنتجات
                      </Label>
                    </div>
                  </RadioGroup>
                  {signUpErrors.role && (
                    <p className="text-sm text-destructive">{signUpErrors.role}</p>
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
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
