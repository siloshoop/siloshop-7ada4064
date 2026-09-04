import { useEffect, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { friendlyOrderError } from "@/lib/orderStatus";
import { updateSellerOrderShipping, type SellerOrderRow } from "@/lib/sellerOrders";

interface Props {
  order: SellerOrderRow;
  disabled?: boolean;
  onSaved?: () => void;
}

const toDateInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

const SellerOrderShippingForm = ({ order, disabled, onSaved }: Props) => {
  const { toast } = useToast();
  const [company, setCompany] = useState("");
  const [eta, setEta] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCompany(order.courier_name || "");
    setEta(toDateInput(order.estimated_delivery));
    setNotes("");
  }, [order.id, order.courier_name, order.estimated_delivery]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSellerOrderShipping(order.id, {
        shippingCompany: company.trim() || null,
        estimatedDelivery: eta ? new Date(`${eta}T12:00:00`).toISOString() : null,
        shippingNotes: notes.trim() || null,
      });
      toast({ title: "تم الحفظ", description: "تم تحديث بيانات الشحن" });
      onSaved?.();
    } catch (e) {
      toast({ title: "خطأ", description: friendlyOrderError(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="grid gap-1.5">
        <Label htmlFor="ship-company">شركة الشحن</Label>
        <Input id="ship-company" value={company} disabled={disabled} maxLength={80}
          onChange={(e) => setCompany(e.target.value)} placeholder="مثال: أرامكس" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ship-eta">موعد التسليم المتوقع</Label>
        <Input id="ship-eta" type="date" value={eta} disabled={disabled}
          min={new Date().toISOString().slice(0, 10)} onChange={(e) => setEta(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ship-notes">ملاحظات الشحن</Label>
        <Textarea id="ship-notes" value={notes} disabled={disabled} rows={2} maxLength={500}
          onChange={(e) => setNotes(e.target.value)} />
      </div>
      <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving || disabled}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
        حفظ بيانات الشحن
      </Button>
    </div>
  );
};

export default SellerOrderShippingForm;
