import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Banknote, Smartphone } from "lucide-react";
import { z } from "zod";

// Validation schemas for payment inputs
const phoneSchema = z.string().regex(/^09\d{8}$/, "رقم الهاتف غير صالح - يجب أن يبدأ بـ 09 ويتكون من 10 أرقام");

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { orderId, amount } = location.state || {};
  
  // Only two supported methods: cash on delivery, or Sham Cash (mobile wallet).
  // Sham Cash is mapped to backend allowed method "syriatel" so no migration is needed.
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "sham_cash">("cash");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    if (!orderId || !amount) {
      toast({
        title: "خطأ",
        description: "معلومات الطلب غير صحيحة",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "sham_cash") {
      const normalized = phoneNumber.replace(/[\s-]/g, "");
      const phoneValidation = phoneSchema.safeParse(normalized);
      if (!phoneValidation.success) {
        toast({
          title: "خطأ",
          description: phoneValidation.error.errors[0]?.message || "رقم الهاتف غير صالح",
          variant: "destructive",
        });
        return;
      }
    }

    setProcessing(true);

    try {
      // Server-side payment + order confirmation: amount is derived from
      // orders.total_amount inside record_payment() so the client cannot
      // forge a settlement amount.
      const backendMethod = paymentMethod === "sham_cash" ? "syriatel" : "cash";
      const { error: paymentError } = await supabase.rpc("record_payment", {
        _order_id: orderId,
        _payment_method: backendMethod,
        _payment_details: {
          wallet: paymentMethod === "sham_cash" ? "sham_cash" : null,
          phone_number: phoneNumber ? phoneNumber.replace(/[\s-]/g, "") : null,
        },
      });

      if (paymentError) throw paymentError;

      toast({
        title: "تم الدفع بنجاح",
        description: "تم تأكيد طلبك وجاري معالجته",
      });

      navigate("/orders");
    } catch (error) {
      console.error("Payment error:", error);
      toast({
        title: "خطأ في الدفع",
        description: "حدث خطأ أثناء معالجة الدفع",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">إتمام الطلب</h1>

      <Card className="p-6 mb-6">
        <div className="mb-4">
          <p className="text-lg">المبلغ الإجمالي:</p>
          <p className="text-3xl font-bold text-primary">{amount?.toFixed(2)} ل.س</p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">اختر طريقة الدفع</h2>

        <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "cash" | "sham_cash")}>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="cash" id="cash" />
              <Label htmlFor="cash" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Banknote className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">الدفع عند الاستلام</p>
                    <p className="text-sm text-muted-foreground">ادفع نقداً عند استلام الطلب</p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="sham_cash" id="sham_cash" />
              <Label htmlFor="sham_cash" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">شام كاش</p>
                    <p className="text-sm text-muted-foreground">ادفع عبر محفظة شام كاش الإلكترونية</p>
                  </div>
                </div>
              </Label>
            </div>
          </div>
        </RadioGroup>

        {paymentMethod === "sham_cash" && (
          <div className="mt-6">
            <Label htmlFor="phone">رقم هاتف محفظة شام كاش</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="09xxxxxxxx"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-2"
              dir="ltr"
            />
          </div>
        )}

        <Button
          onClick={handlePayment}
          disabled={processing}
          className="w-full mt-6"
          size="lg"
        >
          {processing ? (
            <>
              <Loader2 className="ml-2 h-5 w-5 animate-spin" />
              جاري المعالجة...
            </>
          ) : (
            "تأكيد الطلب"
          )}
        </Button>
      </Card>
    </div>
  );
};

export default Payment;
