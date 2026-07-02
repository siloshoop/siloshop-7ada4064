import { ElementType } from "react";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  as?: ElementType;
  className?: string;
};

const BrandLogo = ({ as: Tag = "span", className }: BrandLogoProps) => {
  return (
    <Tag className={cn("inline-flex items-baseline gap-1 font-extrabold tracking-tight", className)}>
      <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        Silo
      </span>
      <span className="text-foreground">Shop</span>
    </Tag>
  );
};

export default BrandLogo;