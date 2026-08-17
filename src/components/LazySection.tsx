import React, { useState, useEffect, useRef, Suspense } from "react";
import { Loader2 } from "lucide-react";

interface LazySectionProps {
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
  /**
   * Space reserved before the section mounts, so the page does not jump
   * (CLS) when the lazy chunk arrives. Roughly matches a product rail:
   * header + one row of cards. Released once the real content is mounted,
   * so short sections never leave an empty gap.
   */
  reserveClassName?: string;
}

const LazySection = ({
  children,
  threshold = 0.1,
  rootMargin = "200px",
  reserveClassName = "min-h-[340px] md:min-h-[400px]",
}: LazySectionProps) => {
  const [isIntersecting, setIntersecting] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIntersecting(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return (
    <div ref={sectionRef} className={isIntersecting ? undefined : reserveClassName}>
      {isIntersecting ? (
        <Suspense
          fallback={
            <div className={`flex items-center justify-center ${reserveClassName}`}>
              <Loader2 className="h-6 w-6 animate-spin text-primary/30" />
            </div>
          }
        >
          {children}
        </Suspense>
      ) : null}
    </div>
  );
};

export default LazySection;
