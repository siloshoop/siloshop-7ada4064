import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { requestSellerDeletion } from "@/lib/sellerDeletion";

export default function DeleteStoreCard() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = async () => {
    if (busy || !password || confirmation.trim() !== "حذف") return;
    setBusy(true);
    try {
      await requestSellerDeletion("store", password, confirmation.trim());
      await queryClient.cancelQueries();
      queryClient.clear();
      window.dispatchEvent(new Event("activation-changed"));
      window.dispatchEvent(new Event("stock-updated"));
      setOpen(false);
      toast({ title: "تم حذف المتجر", description: "حُذفت بيانات المتجر ومنتجاته وملفاته المؤهلة؛ بقي حسابك كمشتري." });
      navigate("/profile", { replace: true });
    } catch (error) {
      toast({ title: "لم يكتمل الحذف", description: error instanceof Error ? error.message : "أعد المحاولة", variant: "destructive" });
    } finally { setBusy(false); setPassword(""); }
  };
  return <Card className="mt-6 space-y-3 border-destructive/40 p-4 sm:p-6">
    <h2 className="flex items-center gap-2 font-semibold text-destructive"><Trash2 className="h-5 w-5" />حذف المتجر نهائيًا</h2>
    <p className="text-sm text-muted-foreground">سيُحذف المتجر ومنتجاته وصوره وإعداداته نهائيًا، مع بقاء حسابك كمشتري. السجلات المرتبطة بطلبات أو مستحقات تحتاج مراجعة الاحتفاظ القانوني قبل الحذف.</p>
    <AlertDialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); setPassword(""); setConfirmation(""); } }}>
      <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="me-2 h-4 w-4" />حذف المتجر</Button></AlertDialogTrigger>
      <AlertDialogContent className="max-h-[85dvh] max-w-[92vw] overflow-y-auto sm:max-w-lg">
        <AlertDialogHeader><AlertDialogTitle>تأكيد حذف المتجر</AlertDialogTitle><AlertDialogDescription>هذا الإجراء نهائي. أدخل كلمة المرور واكتب «حذف» للتأكيد.</AlertDialogDescription></AlertDialogHeader>
        <div className="space-y-3">
          <Label htmlFor="store-delete-password">كلمة المرور</Label><Input id="store-delete-password" type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
          <Label htmlFor="store-delete-confirm">اكتب «حذف»</Label><Input id="store-delete-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} />
        </div>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy || !password || confirmation.trim() !== "حذف"} onClick={(e) => { e.preventDefault(); void remove(); }}>{busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}حذف نهائي</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Card>;
}