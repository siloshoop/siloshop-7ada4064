import { useNavigate } from "react-router-dom";
import { MessageCircle, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReportDialog from "@/components/ReportDialog";

interface Props {
  orderId?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
}

/**
 * Post-purchase support: buyers can only contact the seller of this order
 * or report a delivery issue. No seller selection is possible.
 */
const OrderHelpActions = ({ orderId, vendorId, vendorName }: Props) => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LifeBuoy className="h-5 w-5" />
          هل تحتاج مساعدة؟
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          يمكنك التواصل مع بائع هذا الطلب مباشرة أو الإبلاغ عن مشكلة في التوصيل.
        </p>
        {vendorId && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/chat/${vendorId}${orderId ? `?order=${orderId}` : ""}`)}
          >
            <MessageCircle className="h-4 w-4 ml-2" />
            التواصل مع البائع
          </Button>
        )}
        {vendorId && (
          <ReportDialog
            kind="seller"
            targetId={vendorId}
            targetName={vendorName}
            variant="outline"
            size="default"
            className="w-full"
            label="الإبلاغ عن مشكلة في التوصيل"
          />
        )}
      </CardContent>
    </Card>
  );
};

export default OrderHelpActions;
