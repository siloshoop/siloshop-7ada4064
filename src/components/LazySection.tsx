import React, { useState, useEffect, useRef, Suspense } from "react";
import { Loader2 } from "lucide-react";

interface LazySectionProps {
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}

const LazySection = ({ children, threshold = 0.1, rootMargin = "200px" }: LazySectionProps) => {
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
    <div ref={sectionRef} className="min-h-[100px]">
      {isIntersecting ? (
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary/30" />
          </div>
        }>
          {children}
        </Suspense>
      ) : null}
    </div>
  );
};

export default LazySection;
