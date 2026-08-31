import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
const Footer = () => {
  const [email, setEmail] = useState("");
  const {
    toast
  } = useToast();
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {
        error
      } = await supabase.from("newsletter_subscriptions").insert([{
        email
      }]);
      if (error) throw error;
      toast({
        title: "تم الاشتراك بنجاح",
        description: "شكراً لاشتراكك في نشرتنا البريدية"
      });
      setEmail("");
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message.includes("duplicate") ? "هذا البريد مشترك بالفعل" : "حدث خطأ، يرجى المحاولة مرة أخرى",
        variant: "destructive"
      });
    }
  };
  return <footer className="bg-muted/50 border-t relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>
      
      <div className="container px-4 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="animate-fade-in">
            <BrandLogo as="h2" className="text-3xl md:text-4xl mb-4 block" />
            <p className="text-muted-foreground mb-4">
              وجهتك المفضلة للتسوق أونلاين بأفضل الأسعار وأعلى جودة
            </p>
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" className="hover-scale glow-on-hover" asChild>
                <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="فيسبوك">
                  <Facebook className="h-5 w-5" />
                </a>
              </Button>
              <Button size="icon" variant="ghost" className="hover-scale glow-on-hover" asChild>
                <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="انستغرام">
                  <Instagram className="h-5 w-5" />
                </a>
              </Button>
              <Button size="icon" variant="ghost" className="hover-scale glow-on-hover" asChild>
                <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="تويتر">
                  <Twitter className="h-5 w-5" />
                </a>
              </Button>
              <Button size="icon" variant="ghost" className="hover-scale glow-on-hover" asChild>
                <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="يوتيوب">
                  <Youtube className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">خدمة العملاء</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link to="/contact" className="hover:text-foreground transition-colors story-link">
                  اتصل بنا
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-foreground transition-colors story-link">
                  الأسئلة الشائعة
                </Link>
              </li>
              <li>
                <Link to="/shipping" className="hover:text-foreground transition-colors story-link">
                  الشحن والتوصيل
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-foreground transition-colors story-link">
                  سياسة الخصوصية
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-foreground transition-colors story-link">
                  الشروط والأحكام
                </Link>
              </li>
            </ul>
          </div>

          <div className="animate-fade-in stagger-2">
            <h4 className="font-semibold mb-4">روابط سريعة</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <Link to="/about" className="hover:text-foreground transition-colors story-link">
                  من نحن
                </Link>
              </li>
              <li>
                <Link to="/blog" className="hover:text-foreground transition-colors story-link">
                  المدونة
                </Link>
              </li>
              <li>
                <Link to="/careers" className="hover:text-foreground transition-colors story-link">
                  الوظائف
                </Link>
              </li>
              <li>
                <Link to="/partners" className="hover:text-foreground transition-colors story-link">
                  الشركاء
                </Link>
              </li>
            </ul>
          </div>

          <div className="animate-fade-in stagger-3">
            <h4 className="font-semibold mb-4">اشترك في النشرة</h4>
            <p className="text-muted-foreground mb-4">
              احصل على آخر العروض والتخفيضات
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input type="email" placeholder="بريدك الإلكتروني" className="flex-1 px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary/50 transition-all" value={email} onChange={e => setEmail(e.target.value)} required />
              <Button type="submit" className="glow-on-hover">اشترك</Button>
            </form>
          </div>
        </div>

        <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
          <p className="text-base">
            © 2024 siloshop. جميع الحقوق محفوظة.
          </p>
        </div>
      </div>
    </footer>;
};
export default Footer;