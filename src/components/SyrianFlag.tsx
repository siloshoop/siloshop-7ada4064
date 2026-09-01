import { cn } from "@/lib/utils";

/**
 * Syrian flag rendered as inline SVG (fully transparent background, no image
 * request). Sized at text height so it can sit anywhere the old emoji/image did.
 */
const SyrianFlag = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 30 20"
    role="img"
    aria-label="علم سوريا"
    className={cn("inline-block h-[1em] w-auto align-[-0.125em]", className)}
  >
    <rect width="30" height="20" fill="#FFFFFF" />
    <rect width="30" height="6.667" y="0" fill="#0F8A45" />
    <rect width="30" height="6.667" y="13.333" fill="#000000" />
    <g fill="#E12C2C">
      {[8, 15, 22].map((cx) => (
        <polygon
          key={cx}
          points="0,-2.4 0.706,-0.742 2.283,-0.742 1.008,0.283 1.484,1.94 0,0.95 -1.484,1.94 -1.008,0.283 -2.283,-0.742 -0.706,-0.742"
          transform={`translate(${cx} 10)`}
        />
      ))}
    </g>
  </svg>
);

export default SyrianFlag;
