import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  vendorId: string;
  /** Initial follower count coming from the store profile RPC. */
  followerCount?: number;
  onCountChange?: (count: number) => void;
  className?: string;
  size?: "sm" | "default" | "lg";
}

/** Follow / unfollow a seller store, with optimistic follower count updates. */
const FollowStoreButton = ({ vendorId, followerCount = 0, onCountChange, className, size = "default" }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || !vendorId) {
      setFollowing(false);
      setChecked(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("vendor_followers")
        .select("id")
        .eq("user_id", user.id)
        .eq("vendor_id", vendorId)
        .maybeSingle();
      if (!cancelled) {
        setFollowing(!!data);
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, vendorId]);

  const toggle = async () => {
    if (!user) {
      toast({ title: "يجب تسجيل الدخول", description: "سجّل الدخول لمتابعة المتاجر" });
      navigate("/auth");
      return;
    }
    setLoading(true);
    try {
      if (following) {
        const { error } = await supabase
          .from("vendor_followers")
          .delete()
          .eq("user_id", user.id)
          .eq("vendor_id", vendorId);
        if (error) throw error;
        setFollowing(false);
        onCountChange?.(Math.max(0, followerCount - 1));
        toast({ title: "تم إلغاء المتابعة" });
      } else {
        const { error } = await supabase
          .from("vendor_followers")
          .insert({ user_id: user.id, vendor_id: vendorId });
        // Ignore duplicate-follow races.
        if (error && !error.message.includes("duplicate")) throw error;
        setFollowing(true);
        onCountChange?.(followerCount + 1);
        toast({ title: "تتابع هذا المتجر الآن", description: "ستصلك إشعارات بمنتجاته الجديدة" });
      }
    } catch (error: any) {
      toast({ title: "تعذر تنفيذ العملية", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={toggle}
      disabled={loading || !checked}
      size={size}
      variant={following ? "outline" : "default"}
      className={`rounded-full ${className ?? ""}`}
    >
      {loading ? (
        <Loader2 className="ml-1 h-4 w-4 animate-spin" />
      ) : following ? (
        <UserCheck className="ml-1 h-4 w-4" />
      ) : (
        <UserPlus className="ml-1 h-4 w-4" />
      )}
      {following ? "تتابع المتجر" : "متابعة المتجر"}
      {following && <Heart className="mr-1 h-3.5 w-3.5 fill-current" />}
    </Button>
  );
};

export default FollowStoreButton;