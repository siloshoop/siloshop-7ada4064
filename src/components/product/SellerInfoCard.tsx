import { useNavigate } from "react-router-dom";
import { Store, MessageCircle, Star, ShieldCheck, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ChatButton from "@/components/ChatButton";
import ReportDialog from "@/components/ReportDialog";

interface Props {
  vendorId: string;
  vendorName: string | null;
  productId?: string;
  isPlatform?: boolean;
  rating?: number;
  ratingCount?: number;
}

/** Seller identity block shown on the product page. */
const SellerInfoCard = ({
  vendorId,
  vendorName,
  productId,
  isPlatform,
  rating,
  ratingCount,
}: Props) => {
  const navigate = useNavigate();
  const displayName = isPlatform ? "سيلو شوب" : vendorName || "بائع";

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Store className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{displayName}</h3>
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <ShieldCheck className="h-3 w-3" />
              {isPlatform ? "متجر المنصة" : "بائع معتمد"}
            </Badge>
          </div>
          {typeof rating === "number" && rating > 0 ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)} من 5
              {ratingCount ? ` · ${ratingCount} تقييم للبائع` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">بائع جديد على سيلو شوب</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => navigate(`/store/${vendorId}`)}
        >
          <ChevronLeft className="ml-1 h-4 w-4" />
          زيارة المتجر
        </Button>
        {isPlatform ? (
          <Button variant="ghost" size="sm" className="rounded-full" disabled>
            <MessageCircle className="ml-1 h-4 w-4" />
            دعم المنصة
          </Button>
        ) : (
          <ChatButton vendorId={vendorId} productId={productId} />
        )}
      </div>

      {!isPlatform && (
        <div className="mt-2 flex justify-end">
          <ReportDialog
            kind="seller"
            targetId={vendorId}
            targetName={displayName}
            label="الإبلاغ عن البائع"
            className="h-8 text-xs text-muted-foreground"
          />
        </div>
      )}
    </div>
  );
};

export default SellerInfoCard;
