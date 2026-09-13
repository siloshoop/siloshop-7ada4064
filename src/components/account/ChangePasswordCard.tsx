import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChangePasswordCardProps {
  email: string;
}

const ChangePasswordCard = ({ email }: ChangePasswordCardProps) => {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (newPassword.length < 8) {
      toast({ title: "كلمة مرور ضعيفة", description: "يجب أن تكون 8 أحرف على الأقل", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "غير متطابقة", description: "تأكيد كلمة المرور لا يطابق الجديدة", variant: "destructive" });
      return;
    }
    if (newPassword === currentPassword) {
      toast({ title: "كلمة المرور نفسها", description: "اختر كلمة مرور مختلفة عن الحالية", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Verify identity with the current password before allowing the change
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        toast({ title: "كلمة المرور الحالية غير صحيحة", description: "تأكد من كتابتها ثم أعد المحاولة", variant: "destructive" });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        const raw = error.message || "";
        const description = /weak|pwned|compromis/i.test(raw)
          ? "كلمة المرور هذه مكشوفة في تسريبات معروفة، اختر كلمة مرور أقوى"
          : /same/i.test(raw)
            ? "اختر كلمة مرور مختلفة عن الحالية"
            : raw || "تعذّر تغيير كلمة المرور، حاول مرة أخرى";
        toast({ title: "خطأ", description, variant: "destructive" });
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "تم التغيير", description: "تم تحديث كلمة المرور بنجاح" });
    } catch (err) {
      toast({
        title: "خطأ",
        description: (err as Error)?.message || "تعذّر تغيير كلمة المرور",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">تغيير كلمة المرور</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            dir="ltr"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">8 أحرف على الأقل</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            dir="ltr"
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          حفظ كلمة المرور الجديدة
        </Button>
      </form>
    </Card>
  );
};

export default ChangePasswordCard;
