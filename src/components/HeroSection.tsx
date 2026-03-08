import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const HeroSection = () => {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.15 });

  return (
    <section 
      ref={ref as React.RefObject<HTMLElement>}
      className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-accent/5"
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float-gentle" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-primary/5 to-accent/5 rounded-full blur-3xl animate-pulse-glow" />
      </div>

      <div className="container px-4 py-10 md:py-14 relative z-10">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div className={`space-y-6 text-center lg:text-right transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
            <div className="inline-flex items-center gap-2">
              <span className={`bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 animate-pulse-glow transition-all duration-500 delay-200 ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                <Sparkles className="h-4 w-4" />
                عروض الموسم الجديد
              </span>
            </div>
            <h1 className={`text-4xl md:text-5xl font-bold leading-tight lg:text-4xl transition-all duration-700 delay-100 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              اكتشف أحدث صيحات
              <span className="block bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent mx-px my-3 py-2 animate-gradient-shift bg-[length:200%_200%]">
                الموضة والأناقة
              </span>
            </h1>
            <p className={`text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 transition-all duration-700 delay-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              تسوق من تشكيلة واسعة من الملابس والإكسسوارات العصرية بأفضل الأسعار
            </p>
            <div className={`flex gap-4 flex-wrap justify-center lg:justify-start transition-all duration-700 delay-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <Button 
                size="lg" 
                className="text-base gap-2 group glow-on-hover active:scale-95 transition-transform" 
                onClick={() => navigate("/search")}
              >
                تسوق الآن
                <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-base hover-lift active:scale-95 transition-transform" 
                onClick={() => navigate("/search")}
              >
                عرض المجموعات
              </Button>
            </div>
            <div className={`flex gap-8 justify-center lg:justify-start pt-4 transition-all duration-700 delay-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {[
                { value: "+1000", label: "منتج" },
                { value: "50%", label: "خصم" },
                { value: "24/7", label: "دعم" },
              ].map((stat, i) => (
                <div key={i} className="text-center" style={{ transitionDelay: `${500 + i * 100}ms` }}>
                  <div className={`text-3xl font-bold text-foreground transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: `${600 + i * 120}ms` }}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={`relative transition-all duration-800 delay-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 -translate-x-12 scale-95'}`}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-3xl animate-pulse-glow"></div>
            <img 
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=800&fit=crop" 
              alt="منتجات الموضة" 
              className="relative rounded-3xl shadow-2xl w-full object-cover aspect-square hover:scale-[1.02] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" 
            />
            {/* Floating badge */}
            <div className={`absolute -bottom-4 -right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-full shadow-lg font-bold transition-all duration-700 delay-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-4'}`}>
              خصم حتى 50%
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
