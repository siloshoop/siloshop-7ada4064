import { Link, useLocation } from "react-router-dom";
import { ShieldAlert, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface AccessDeniedProps {
  requiredRole?: string;
  message?: string;
}

const roleLabel: Record<string, string> = {
  vendor: "البائعين",
  admin: "المدراء",
  customer: "العملاء",
};

const AccessDenied = ({ requiredRole, message }: AccessDeniedProps) => {
  const location = useLocation();
  const roleText = requiredRole ? roleLabel[requiredRole] || requiredRole : null;

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-xl border-destructive/30">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">الوصول مرفوض</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              {message
                ? message
                : roleText
                  ? `هذه الصفحة مخصصة لحسابات ${roleText} فقط.`
                  : "لا تملك صلاحية لعرض هذه الصفحة."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              المسار: <code className="font-mono text-xs">{location.pathname}</code>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button asChild className="flex-1">
                <Link to="/">
                  <Home className="ml-2 h-4 w-4" />
                  الصفحة الرئيسية
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/contact">
                  تواصل مع الدعم
                  <ArrowRight className="mr-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default AccessDenied;