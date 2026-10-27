import { Component, type ReactNode, type ErrorInfo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Page render failed", error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main dir="rtl" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <h1 className="text-xl font-semibold">تعذّر عرض الصفحة</h1>
      <p className="text-muted-foreground">حاول تحميل الصفحة مرة أخرى.</p>
      <div className="flex gap-2">
        <Button onClick={() => window.location.reload()}><RefreshCw className="me-2 h-4 w-4" />إعادة المحاولة</Button>
        <Button asChild variant="outline"><Link to="/"><Home className="me-2 h-4 w-4" />الرئيسية</Link></Button>
      </div>
    </main>;
  }
}
export default function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Reset errors on another page, not on same-page filter/history updates.
  // Remounting Routes on every replace() restarts all page reads and can loop.
  return <PageBoundary key={location.pathname}>{children}</PageBoundary>;
}