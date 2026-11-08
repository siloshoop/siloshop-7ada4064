import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useStaffRole } from "@/hooks/useStaffRole";
import useFeatureFlags from "@/hooks/useFeatureFlags";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import AccessDenied from "@/pages/AccessDenied";
import { Button } from "@/components/ui/button";
import { ADMIN_MODULES, AdminModule, canAccessAdminModule } from "./adminModules";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

interface AdminLayoutProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const useAdminModules = () => {
  const { isEnabled, loading } = useFeatureFlags();
  const { role } = useStaffRole();
  const { permissions } = useStaffPermissions();
  const visible = ADMIN_MODULES.filter(
    (m) => canAccessAdminModule(m.href, role, permissions) && (!m.featureFlag || isEnabled(m.featureFlag)),
  );
  return { modules: visible, loading };
};

const NavItem = ({ module, active }: { module: AdminModule; active: boolean }) => (
  <Link
    to={module.href}
    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
      active
        ? "bg-gradient-primary font-semibold text-primary-foreground shadow-elegant"
        : "text-foreground hover:bg-primary/10 hover:text-primary"
    }`}
  >
    <module.icon className="h-4 w-4 shrink-0" />
    <span className="truncate">{module.label}</span>
    {module.comingSoon && (
      <Badge variant="secondary" className="ms-auto text-[10px]">قريبًا</Badge>
    )}
  </Link>
);

const AdminLayout = ({ title, description, actions, children }: AdminLayoutProps) => {
  const { role, loading, error, retry } = useStaffRole();
  const { permissions, loading: permissionsLoading } = useStaffPermissions();
  const { modules } = useAdminModules();
  const { pathname } = useLocation();

  if (loading || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (error) return <div dir="rtl" className="flex min-h-[60vh] flex-col items-center justify-center gap-4"><p role="alert">تعذّر التحقق من صلاحيات الإدارة</p><Button onClick={() => void retry()}>إعادة المحاولة</Button></div>;
  if (!canAccessAdminModule(pathname, role, permissions)) return <AccessDenied />;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <Navbar />
      <div className="container mx-auto flex flex-1 gap-6 px-4 py-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <Card className="sticky top-24 space-y-1 p-2">
            {modules.map((m) => (
              <NavItem key={m.href} module={m} active={pathname === m.href} />
            ))}
          </Card>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              )}
              <div aria-hidden className="mt-2 h-1 w-14 rounded-full bg-gradient-brand" />
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
};

export default AdminLayout;