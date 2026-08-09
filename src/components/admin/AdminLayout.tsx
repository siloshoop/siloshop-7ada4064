import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import useFeatureFlags from "@/hooks/useFeatureFlags";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { ADMIN_MODULES, AdminModule } from "./adminModules";

interface AdminLayoutProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const useAdminModules = () => {
  const { isEnabled, loading } = useFeatureFlags();
  const visible = ADMIN_MODULES.filter(
    (m) => !m.featureFlag || isEnabled(m.featureFlag),
  );
  return { modules: visible, loading };
};

const NavItem = ({ module, active }: { module: AdminModule; active: boolean }) => (
  <Link
    to={module.href}
    className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-foreground hover:bg-muted"
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
  const { isAdmin, loading } = useAdminCheck();
  const { modules } = useAdminModules();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;

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
              <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
              {description && (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              )}
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