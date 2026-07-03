import { ElementType, HTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type BrandLogoProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  className?: string;
  linkToHome?: boolean;
};

const BrandLogo = ({ as: Tag = "span", className, onClick, linkToHome = true, ...rest }: BrandLogoProps) => {
  const navigate = useNavigate();
  const handleClick: React.MouseEventHandler<HTMLElement> = (e) => {
    if (onClick) {
      onClick(e);
      if (e.defaultPrevented) return;
    }
    if (linkToHome) {
      navigate("/");
    }
  };
  const clickable = linkToHome || !!onClick;
  return (
    <Tag
      className={cn(
        "inline-flex items-baseline gap-1 font-extrabold tracking-tight",
        clickable && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={clickable ? handleClick : undefined}
      role={clickable ? "link" : undefined}
      aria-label={clickable ? "الصفحة الرئيسية" : undefined}
      {...rest}
    >
      <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        Silo
      </span>
      <span className="text-foreground">Shop</span>
    </Tag>
  );
};

export default BrandLogo;