import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
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
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-primary/5 to-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 py-10 md:py-14 relative z-10">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div className={`space-y-6 text-center lg:text-right transition-all duration-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
            <div className="inline-flex items-center gap-2">
              <span className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 animate-pulse-glow">
                <Sparkles className="h-4 w-4" />
                عروض الموسم الجديد
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight lg:text-4xl">
              اكتشف أحدث صيحات
              <span className="block bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent mx-px my-3 py-2 animate-gradient-shift bg-[length:200%_200%]">
                الموضة والأناقة
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              تسوق من تشكيلة واسعة من الملابس والإكسسوارات العصرية بأفضل الأسعار
            </p>
            <div className="flex gap-4 flex-wrap justify-center lg:justify-start">
              <Button 
                size="lg" 
                className="text-base gap-2 group glow-on-hover" 
                onClick={() => navigate("/search")}
              >
                تسوق الآن
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-base hover-lift" 
                onClick={() => navigate("/search")}
              >
                عرض المجموعات
              </Button>
            </div>
            <div className={`flex gap-8 justify-center lg:justify-start pt-4 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">+1000</div>
                <div className="text-sm text-muted-foreground">منتج</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">50%</div>
                <div className="text-sm text-muted-foreground">خصم</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-foreground">24/7</div>
                <div className="text-sm text-muted-foreground">دعم</div>
              </div>
            </div>
          </div>
          <div className={`relative transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-12 scale-95'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-3xl animate-pulse-glow"></div>
            <img 
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=800&fit=crop" 
              alt="منتجات الموضة" 
              className="relative rounded-3xl shadow-2xl w-full object-cover aspect-square hover:scale-[1.02] transition-transform duration-500" 
            />
            {/* Floating badge */}
            <div className="absolute -bottom-4 -right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-full shadow-lg animate-bounce-in font-bold">
              خصم حتى 50%
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;