import { useNavigate } from "react-router-dom";
import { MessageCircle, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReportDialog from "@/components/ReportDialog";

interface Props {
  orderId?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  vendorIds?: string[];
}

/**
 * Post-purchase support: buyers can only contact the seller of this order
 * or report a delivery issue. Only sellers from the saved order are offered.
 */
const OrderHelpActions = ({ orderId, vendorId, vendorName, vendorIds }: Props) => {
  const navigate = useNavigate();
  const sellers = vendorIds ?? (vendorId ? [vendorId] : []);

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
        {sellers.map((sellerId, index) => (
          <Button
            key={sellerId}
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/chat/${sellerId}${orderId ? `?order=${orderId}` : ""}`)}
          >
            <MessageCircle className="h-4 w-4 ml-2" />
            التواصل مع البائع {sellers.length > 1 ? index + 1 : ""}
          </Button>
        ))}
        {sellers.map((sellerId, index) => (
          <ReportDialog
            key={`report-${sellerId}`}
            kind="seller"
            targetId={sellerId}
            targetName={vendorName}
            variant="outline"
            size="default"
            className="w-full"
            label={`الإبلاغ عن مشكلة في التوصيل${sellers.length > 1 ? ` — البائع ${index + 1}` : ""}`}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default OrderHelpActions;
