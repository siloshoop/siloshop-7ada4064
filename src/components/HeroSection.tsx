import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const HeroSection = () => {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.2 });

  return (
    <section 
      ref={ref as React.RefObject<HTMLElement>}
      className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-accent/5"
    >
      <div className="container px-4 py-16 md:py-24">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div className={`space-y-6 text-center lg:text-right transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
            <div className="inline-block">
              <span className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold">
                عروض الموسم الجديد
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight lg:text-4xl">
              اكتشف أحدث صيحات
              <span className="block bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent mx-px my-[11px] px-0 py-[11px]">
                الموضة والأناقة
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              تسوق من تشكيلة واسعة من الملابس والإكسسوارات العصرية بأفضل الأسعار
            </p>
            <div className="flex gap-4 flex-wrap justify-center lg:justify-start">
              <Button size="lg" className="text-base gap-2" onClick={() => navigate("/")}>
                تسوق الآن
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base" onClick={() => navigate("/")}>
                عرض المجموعات
              </Button>
            </div>
            <div className={`flex gap-8 justify-center lg:justify-start pt-4 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div>
                <div className="text-3xl font-bold text-foreground">+1000</div>
                <div className="text-sm text-muted-foreground">منتج</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">50%</div>
                <div className="text-sm text-muted-foreground">خصم</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">24/7</div>
                <div className="text-sm text-muted-foreground">دعم</div>
              </div>
            </div>
          </div>
          <div className={`relative transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-12 scale-95'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-3xl"></div>
            <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=800&fit=crop" alt="منتجات الموضة" className="relative rounded-3xl shadow-2xl w-full object-cover aspect-square" />
          </div>
        </div>
      </div>
    </section>
  );
};
export default HeroSection;