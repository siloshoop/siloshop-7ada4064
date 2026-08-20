import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { BadgeCheck, Menu } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SELLER_MODULES, SELLER_GROUP_LABELS, SellerModule } from "@/lib/sellerModules";
import { cn } from "@/lib/utils";

const groups = ["overview", "catalog", "sales", "growth", "finance", "account"] as const;

const NavList = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { pathname } = useLocation();
  return (
    <nav className="space-y-5" aria-label="قائمة لوحة البائع">
      {groups.map((g) => {
        const items = SELLER_MODULES.filter((m: SellerModule) => m.group === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {SELLER_GROUP_LABELS[g]}
            </p>
            <ul className="space-y-1">
              {items.map((m) => {
                const active = pathname === m.path;
                const Icon = m.icon;
                return (
                  <li key={m.key}>
                    <Link
                      to={m.path}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
};

interface SellerLayoutProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const SellerLayout = ({ title, description, actions, children }: SellerLayoutProps) => (
  <div className="min-h-screen bg-muted/30" dir="rtl">
    <Navbar />
    <div className="container mx-auto px-4 py-6">
      <div className="flex gap-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
              <BadgeCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-primary">بائع موثّق</span>
            </div>
            <ScrollArea className="max-h-[calc(100vh-14rem)] pe-2">
              <NavList />
            </ScrollArea>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-6 flex flex-wrap items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="فتح قائمة لوحة البائع">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 overflow-y-auto">
                <div className="pt-8">
                  <NavList />
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold">{title}</h1>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions}
          </header>
          {children}
        </main>
      </div>
    </div>
  </div>
);

export default SellerLayout;
