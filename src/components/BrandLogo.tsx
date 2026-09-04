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
        "inline-flex items-center leading-none",
        clickable && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={clickable ? handleClick : undefined}
      role={clickable ? "link" : undefined}
      aria-label={clickable ? "الصفحة الرئيسية" : undefined}
      {...rest}
    >
      <img
        src={logoAsset.url}
        alt="SiloShop"
        loading="eager"
        decoding="async"
        className="h-[1.9em] w-auto select-none object-contain"
        draggable={false}
      />
    </Tag>
  );
};

export default BrandLogo;