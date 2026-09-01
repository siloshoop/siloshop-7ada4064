import flagAsset from "@/assets/syria-flag.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Official Syrian flag used across the app. Rendered inline at text size so it
 * can replace the old flag emoji anywhere without affecting layout.
 */
const SyrianFlag = ({ className }: { className?: string }) => (
  <img
    src={flagAsset.url}
    alt="علم سوريا"
    loading="lazy"
    className={cn("inline-block h-[1em] w-auto align-[-0.125em] object-contain", className)}
  />
);

export default SyrianFlag;
