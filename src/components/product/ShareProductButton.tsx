import { Send, Share2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { buildSocialShareUrl, shareContent, toPublicUrl } from "@/lib/share";
import { externalLinkTarget } from "@/lib/externalLinks";
import { useToast } from "@/hooks/use-toast";

interface Props {
  productId: string;
  productName: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  showLabel?: boolean;
  showTelegram?: boolean;
}

export const productShareUrl = (productId: string) => toPublicUrl(`/product/${productId}`);

const ShareProductButton = ({ productId, productName, variant = "ghost", size = "sm", className, showLabel = true, showTelegram = false }: Props) => {
  const { toast } = useToast();
  const onShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = productShareUrl(productId);
    const result = await shareContent({ title: productName, text: `${productName} على SiloShop`, url });
    if (result === "copied") toast({ title: "تم نسخ الرابط", description: url });
    else if (result === "failed") toast({ title: "تعذرت المشاركة", description: url, variant: "destructive" });
  };
  const shareButton = (
    <Button type="button" variant={variant} size={size} className={className} onClick={onShare} aria-label="مشاركة المنتج">
      <Share2 className={showLabel ? "ml-2 h-4 w-4" : "h-4 w-4"} />
      {showLabel && "مشاركة"}
    </Button>
  );
  if (!showTelegram) return shareButton;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      {shareButton}
      <Button variant={variant} size="icon" className={className} asChild>
        <a
          href={buildSocialShareUrl("telegram", productShareUrl(productId), `${productName} على SiloShop`)}
          target={externalLinkTarget()}
          rel="noopener noreferrer"
          aria-label="مشاركة المنتج عبر تيليجرام"
          title="تيليجرام"
          onClick={(e) => e.stopPropagation()}
        >
          <Send className="h-4 w-4" />
        </a>
      </Button>
    </span>
  );
};

export default ShareProductButton;
