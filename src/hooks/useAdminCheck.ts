import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useAdminCheck = () => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      setAdminLoading(false);
      navigate("/auth");
      return;
    }

    if (user) {
      checkAdmin();
    }
  }, [user, authLoading, navigate]);

  const checkAdmin = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (error) throw error;

      if (data) {
        setIsAdmin(true);
      } else {
        toast({
          title: "غير مصرح",
          description: "هذه الصفحة مخصصة للمدراء فقط",
          variant: "destructive",
        });
        navigate("/");
      }
    } catch {
      navigate("/");
    } finally {
      setAdminLoading(false);
    }
  };

  return {
    user,
    isAdmin,
    loading: authLoading || adminLoading,
  };
};
