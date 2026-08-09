import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveShippingInfo, friendlyOrderError, type ShippingInfoInput } from "@/lib/orderStatus";

export interface ShippingInfoValues extends ShippingInfoInput {}

interface Props {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ShippingInfoValues;
  onSaved?: (values: ShippingInfoValues) => void;
}

const toDateInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

/** Seller/admin form for shipping company, tracking number, driver, notes and ETA. */
const ShippingInfoDialog = ({ orderId, open, onOpenChange, initial, onSaved }: Props) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [estimated, setEstimated] = useState("");

  useEffect(() => {
    if (!open) return;
    setCourierName(initial?.courierName || "");
    setTrackingNumber(initial?.trackingNumber || "");
    setDriverName(initial?.driverName || "");
    setDriverPhone(initial?.driverPhone || "");
    setDeliveryNotes(initial?.deliveryNotes || "");
    setEstimated(toDateInput(initial?.estimatedDelivery));
  }, [open, initial]);

  const handleSave = async () => {
    if (!orderId) return;
    if (driverPhone && !/^[0-9+\s-]{6,20}$/.test(driverPhone.trim())) {
      toast({ title: "رقم غير صحيح", description: "تحقق من رقم هاتف السائق", variant: "destructive" });
      return;
    }
    const values: ShippingInfoValues = {
      courierName: courierName.trim() || null,
      trackingNumber: trackingNumber.trim() || null,
      driverName: driverName.trim() || null,
      driverPhone: driverPhone.trim() || null,
      deliveryNotes: deliveryNotes.trim().slice(0, 500) || null,
      estimatedDelivery: estimated ? new Date(`${estimated}T12:00:00`).toISOString() : null,
    };
    setSaving(true);
    try {
      await saveShippingInfo(orderId, values);
      toast({ title: "تم الحفظ", description: "تم تحديث معلومات الشحن" });
      onSaved?.(values);
      onOpenChange(false);
    } catch (e) {
      toast({ title: "خطأ", description: friendlyOrderError(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            معلومات الشحن والتسليم
          </DialogTitle>
          <DialogDescription>
            تظهر هذه المعلومات للعميل في صفحة تتبع الطلب. سيتم إشعار العميل عند تغيير موعد التسليم المتوقع.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="courier">شركة الشحن</Label>
            <Input id="courier" value={courierName} maxLength={80}
              placeholder="مثال: أرامكس، الفؤاد، البريد السوري"
              onChange={(e) => setCourierName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tracking">رقم التتبع</Label>
            <Input id="tracking" value={trackingNumber} maxLength={60}
              placeholder="أدخل رقم تتبع الشحنة"
              onChange={(e) => setTrackingNumber(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="driver">اسم السائق (اختياري)</Label>
              <Input id="driver" value={driverName} maxLength={80}
                onChange={(e) => setDriverName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driverPhone">هاتف السائق (اختياري)</Label>
              <Input id="driverPhone" value={driverPhone} maxLength={20} inputMode="tel"
                onChange={(e) => setDriverPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eta">موعد التسليم المتوقع</Label>
            <Input id="eta" type="date" value={estimated}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setEstimated(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deliveryNotes">ملاحظات التوصيل</Label>
            <Textarea id="deliveryNotes" value={deliveryNotes} maxLength={500} rows={3}
              placeholder="مثال: التسليم بعد الظهر، يرجى الاتصال قبل الوصول"
              onChange={(e) => setDeliveryNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (<><Loader2 className="h-4 w-4 animate-spin ml-2" />جاري الحفظ...</>) : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShippingInfoDialog;