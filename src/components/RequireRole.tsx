import { useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AccessDenied from "@/pages/AccessDenied";

type Role = "vendor" | "customer" | "admin" | "super_admin" | "moderator";

const ADMIN_ROLES: Role[] = ["admin", "super_admin", "moderator"];

interface RequireRoleProps {
  role: Role | Role[];
  children: ReactNode;
}

const Fallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-busy="true">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const RequireRole = ({ role, children }: RequireRoleProps) => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [denied, setDenied] = useState(false);
  const navigate = useNavigate();
  const roles = Array.isArray(role) ? role : [role];

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    (async () => {
      try {
        let ok = false;
        const requestedAdminRoles = roles.filter((r) => ADMIN_ROLES.includes(r));
        if (requestedAdminRoles.length > 0) {
          for (const r of requestedAdminRoles) {
            const { data } = await supabase.rpc("has_role", {
              _user_id: user.id,
              _role: r as "admin" | "super_admin" | "moderator",
            });
            if (data) { ok = true; break; }
          }
          // an admin/super_admin always satisfies a moderator-level route
          if (!ok && roles.includes("moderator")) {
            const { data } = await supabase.rpc("has_any_admin_role", { _user_id: user.id });
            if (data) ok = true;
          }
          if (!ok && roles.includes("admin")) {
            const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
            if (data) ok = true;
          }
        }
        if (!ok && (roles.includes("vendor") || roles.includes("customer"))) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          if (profile && roles.includes(profile.role as Role)) ok = true;
        }
        if (!ok) {
          setDenied(true);
          return;
        }
        setAllowed(true);
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  if (loading || checking) return <Fallback />;
  if (denied) return <AccessDenied requiredRole={roles[0]} />;
  if (!allowed) return null;
  return <>{children}</>;
};

export default RequireRole;