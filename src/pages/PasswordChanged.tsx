import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, LogIn, Home } from "lucide-react";

const PasswordChanged = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // End the recovery session so the user signs in with the new password
    supabase.auth.signOut().catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border/50 shadow-2xl bg-card/80 backdrop-blur-xl text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">تم تغيير كلمة المرور بنجاح</CardTitle>
          <CardDescription>
            أصبحت كلمة المرور الجديدة فعّالة. لأسباب أمنية تم إنهاء الجلسة الحالية، سجّل الدخول
            من جديد باستخدام كلمة المرور الجديدة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" size="lg" onClick={() => navigate("/auth")}>
            <LogIn className="h-4 w-4 ml-2" />
            العودة لتسجيل الدخول
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/">
              <Home className="h-4 w-4 ml-2" />
              الصفحة الرئيسية
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            إذا لم تكن أنت من طلب تغيير كلمة المرور، تواصل معنا فوراً عبر صفحة الدعم.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordChanged;
