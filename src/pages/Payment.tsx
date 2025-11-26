import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, Smartphone } from "lucide-react";

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { orderId, amount } = location.state || {};
  
  const [paymentMethod, setPaymentMethod] = useState("syriatel");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [cardNumber, setCardNumber] = useState("");
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

    if (paymentMethod !== "cash") {
      if (paymentMethod === "bemo" && !cardNumber) {
        toast({
          title: "خطأ",
          description: "الرجاء إدخال رقم البطاقة",
          variant: "destructive",
        });
        return;
      }
      if ((paymentMethod === "syriatel" || paymentMethod === "mtn") && !phoneNumber) {
        toast({
          title: "خطأ",
          description: "الرجاء إدخال رقم الهاتف",
          variant: "destructive",
        });
        return;
      }
    }

    setProcessing(true);

    try {
      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          order_id: orderId,
          payment_method: paymentMethod,
          amount: amount,
          payment_status: paymentMethod === "cash" ? "pending" : "completed",
          transaction_id: `TXN-${Date.now()}`,
          payment_details: {
            phone_number: phoneNumber || null,
            card_number: cardNumber ? `****${cardNumber.slice(-4)}` : null,
          },
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Update order status
      await supabase
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", orderId);

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
      <h1 className="text-3xl font-bold mb-6">الدفع</h1>

      <Card className="p-6 mb-6">
        <div className="mb-4">
          <p className="text-lg">المبلغ الإجمالي:</p>
          <p className="text-3xl font-bold text-primary">{amount?.toFixed(2)} ل.س</p>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">اختر طريقة الدفع</h2>

        <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="syriatel" id="syriatel" />
              <Label htmlFor="syriatel" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">Syriatel Cash</p>
                    <p className="text-sm text-muted-foreground">ادفع عبر محفظة سيريتل</p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="mtn" id="mtn" />
              <Label htmlFor="mtn" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">MTN Mobile Money</p>
                    <p className="text-sm text-muted-foreground">ادفع عبر محفظة MTN</p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="bemo" id="bemo" />
              <Label htmlFor="bemo" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">Bemo Card</p>
                    <p className="text-sm text-muted-foreground">ادفع ببطاقة بنك بيمو</p>
                  </div>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse border rounded-lg p-4 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="cash" id="cash" />
              <Label htmlFor="cash" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">الدفع عند الاستلام</p>
                    <p className="text-sm text-muted-foreground">ادفع نقداً عند استلام الطلب</p>
                  </div>
                </div>
              </Label>
            </div>
          </div>
        </RadioGroup>

        {(paymentMethod === "syriatel" || paymentMethod === "mtn") && (
          <div className="mt-6">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="09xxxxxxxx"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-2"
            />
          </div>
        )}

        {paymentMethod === "bemo" && (
          <div className="mt-6">
            <Label htmlFor="card">رقم البطاقة</Label>
            <Input
              id="card"
              type="text"
              placeholder="xxxx xxxx xxxx xxxx"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              maxLength={16}
              className="mt-2"
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
            "تأكيد الدفع"
          )}
        </Button>
      </Card>
    </div>
  );
};

export default Payment;
