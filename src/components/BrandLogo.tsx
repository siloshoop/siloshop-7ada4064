import { ElementType, HTMLAttributes, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type BrandLogoProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  className?: string;
  linkToHome?: boolean;
};

const BrandLogo = ({ as: Tag = "span", className, onClick, linkToHome = true, ...rest }: BrandLogoProps) => {
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);
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
        "inline-flex min-w-0 items-center gap-2 leading-none",
        clickable && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={clickable ? handleClick : undefined}
      role={clickable ? "link" : undefined}
      aria-label={clickable ? "الصفحة الرئيسية" : undefined}
      {...rest}
    >
      {!imageFailed && (
        <img
          src="/favicon.png"
          alt=""
          loading="eager"
          decoding="async"
          className="h-[1.65em] w-[1.65em] shrink-0 select-none object-contain"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
      <span className="min-w-0 truncate font-bold text-foreground" dir="ltr">SiloShop</span>
    </Tag>
  );
};

export default BrandLogo;