import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ChatButtonProps {
  vendorId: string;
  productId?: string;
}

const ChatButton = ({ vendorId, productId }: ChatButtonProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleChatClick = () => {
    if (!user) {
      toast({
        title: "يجب تسجيل الدخول",
        description: "الرجاء تسجيل الدخول لبدء المحادثة",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (user.id === vendorId) {
      toast({
        title: "لا يمكنك مراسلة نفسك",
        variant: "destructive",
      });
      return;
    }

    navigate(`/chat/${vendorId}${productId ? `?product=${productId}` : ''}`);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleChatClick}
      className="gap-2"
    >
      <MessageCircle className="h-4 w-4" />
      <span>تواصل مع البائع</span>
    </Button>
  );
};

export default ChatButton;
