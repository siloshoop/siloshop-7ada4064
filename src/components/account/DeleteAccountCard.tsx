import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CONFIRM_WORD = "حذف";

const DeleteAccountCard = ({ email }: { email: string }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      // Re-authenticate before a destructive action
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        toast({ title: "كلمة المرور غير صحيحة", description: "تأكد من كتابتها ثم أعد المحاولة", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("delete-own-account", { body: {} });
      const errorCode = (data as { error?: string } | null)?.error;

      if (error || errorCode) {
        const description = errorCode === "open_orders"
          ? "لديك طلبات قيد التنفيذ، يمكنك حذف الحساب بعد اكتمالها أو إلغائها"
          : "تعذّر حذف الحساب، حاول مرة أخرى أو تواصل معنا";
        toast({ title: "لم يتم الحذف", description, variant: "destructive" });
        return;
      }

      await supabase.auth.signOut();
      toast({ title: "تم حذف الحساب", description: "تم حذف حسابك وبياناتك بشكل نهائي" });
      navigate("/", { replace: true });
    } catch (err) {
      toast({
        title: "خطأ",
        description: (err as Error)?.message || "تعذّر حذف الحساب",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6 space-y-4 border-destructive/40">
      <div className="flex items-center gap-2">
        <Trash2 className="h-5 w-5 text-destructive" />
        <h2 className="font-semibold text-destructive">حذف الحساب نهائياً</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        سيتم حذف حسابك وبياناتك الشخصية بشكل نهائي ولا يمكن التراجع عن هذه الخطوة.
      </p>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full sm:w-auto">
            <Trash2 className="h-4 w-4 ml-2" />
            حذف حسابي
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف الحساب</AlertDialogTitle>
            <AlertDialogDescription>
              أدخل كلمة المرور واكتب كلمة «{CONFIRM_WORD}» للتأكيد. هذا الإجراء نهائي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deletePassword">كلمة المرور</Label>
              <Input
                id="deletePassword"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deleteConfirm">اكتب «{CONFIRM_WORD}»</Label>
              <Input
                id="deleteConfirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting || !password || confirmText.trim() !== CONFIRM_WORD}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default DeleteAccountCard;
