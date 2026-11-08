import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // The host answers every path with HTTP 200, so tell search engines not to index missing pages.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex");
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">الصفحة غير موجودة</p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
