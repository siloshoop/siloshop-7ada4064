import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-accent/5">
      <div className="container px-4 py-16 md:py-24">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div className="space-y-6 text-center lg:text-right animate-fade-in">
            <div className="inline-block">
              <span className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold">
                عروض الموسم الجديد
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              اكتشف أحدث صيحات
              <span className="block bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent">
                الموضة والأناقة
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              تسوق من تشكيلة واسعة من الملابس والإكسسوارات العصرية بأفضل الأسعار
            </p>
            <div className="flex gap-4 flex-wrap justify-center lg:justify-start">
              <Button size="lg" className="text-base gap-2">
                تسوق الآن
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base">
                عرض المجموعات
              </Button>
            </div>
            <div className="flex gap-8 justify-center lg:justify-start pt-4">
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
          <div className="relative animate-slide-up">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-3xl"></div>
            <img
              src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&h=800&fit=crop"
              alt="منتجات الموضة"
              className="relative rounded-3xl shadow-2xl w-full object-cover aspect-square"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
