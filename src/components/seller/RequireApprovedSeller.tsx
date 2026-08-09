import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Clock, XCircle, PauseCircle, Store } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import RequireRole from "@/components/RequireRole";
import { useSellerStatus } from "@/hooks/useSellerStatus";

const Fallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-busy="true">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const StateCard = ({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="min-h-screen bg-background" dir="rtl">
    <Navbar />
    <main className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg text-center">
        <CardContent className="space-y-4 p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">{icon}</div>
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {action}
            <Button asChild variant="outline">
              <Link to="/dashboard">لوحة حسابي</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
    <Footer />
  </div>
);

/**
 * Gate for every seller-only route: the user must have the vendor role AND
 * an approved seller application. Pending / rejected / suspended sellers get a
 * clear explanation instead of a broken dashboard.
 */
const RequireApprovedSeller = ({ children }: { children: ReactNode }) => {
  const { status, rejectionReason, loading } = useSellerStatus();

  return (
    <RequireRole role="vendor">
      {loading ? (
        <Fallback />
      ) : status === "approved" ? (
        <>{children}</>
      ) : status === "pending" ? (
        <StateCard
          icon={<Clock className="h-7 w-7 text-amber-500" />}
          title="طلبك قيد المراجعة"
          description="لا يمكنك الوصول إلى لوحة البائع أو إضافة منتجات حتى تتم موافقة الإدارة على طلبك. سنخبرك عبر الإشعارات فوراً."
        />
      ) : status === "rejected" ? (
        <StateCard
          icon={<XCircle className="h-7 w-7 text-destructive" />}
          title="تم رفض طلب البائع"
          description={rejectionReason ?? "يمكنك تعديل بياناتك وإعادة التقديم."}
          action={
            <Button asChild>
              <Link to="/seller/application">تعديل الطلب وإعادة التقديم</Link>
            </Button>
          }
        />
      ) : status === "suspended" ? (
        <StateCard
          icon={<PauseCircle className="h-7 w-7 text-muted-foreground" />}
          title="حساب البائع موقوف"
          description="تم إيقاف حسابك كبائع مؤقتاً. يرجى التواصل مع الإدارة لمراجعة الحالة."
          action={
            <Button asChild>
              <Link to="/contact">تواصل مع الإدارة</Link>
            </Button>
          }
        />
      ) : (
        <StateCard
          icon={<Store className="h-7 w-7 text-primary" />}
          title="لم تقدّم طلب بائع بعد"
          description="قدّم طلب الانضمام كبائع وأرفق مستنداتك، وبعد الموافقة ستُفتح لك لوحة البائع كاملة."
          action={
            <Button asChild>
              <Link to="/seller/application">تقديم طلب بائع</Link>
            </Button>
          }
        />
      )}
    </RequireRole>
  );
};

export default RequireApprovedSeller;
