import { Share2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { shareContent, toPublicUrl } from "@/lib/share";
import { useToast } from "@/hooks/use-toast";

interface Props {
  productId: string;
  productName: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  showLabel?: boolean;
}

export const productShareUrl = (productId: string) => toPublicUrl(`/product/${productId}`);

const ShareProductButton = ({ productId, productName, variant = "ghost", size = "sm", className, showLabel = true }: Props) => {
  const { toast } = useToast();
  const onShare = async () => {
    const url = productShareUrl(productId);
    const result = await shareContent({ title: productName, text: `${productName} على SiloShop`, url });
    if (result === "copied") toast({ title: "تم نسخ الرابط", description: url });
    else if (result === "failed") toast({ title: "تعذرت المشاركة", description: url, variant: "destructive" });
  };
  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={onShare} aria-label="مشاركة المنتج">
      <Share2 className={showLabel ? "ml-2 h-4 w-4" : "h-4 w-4"} />
      {showLabel && "مشاركة"}
    </Button>
  );
};

export default ShareProductButton;
