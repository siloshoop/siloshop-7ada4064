import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

const Footer = () => {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="container px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-2xl mb-4 bg-gradient-to-l from-primary to-accent bg-clip-text text-transparent">
              متجر
            </h3>
            <p className="text-muted-foreground mb-4">
              وجهتك المفضلة للتسوق أونلاين بأفضل الأسعار وأعلى جودة
            </p>
            <div className="flex gap-2">
              <Button size="icon" variant="ghost">
                <Facebook className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <Instagram className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <Twitter className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <Youtube className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">خدمة العملاء</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">اتصل بنا</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">الأسئلة الشائعة</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">سياسة الإرجاع</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">الشحن والتوصيل</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">روابط سريعة</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">من نحن</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">المدونة</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">الوظائف</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">الشركاء</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">اشترك في النشرة</h4>
            <p className="text-muted-foreground mb-4">
              احصل على آخر العروض والتخفيضات
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="بريدك الإلكتروني"
                className="flex-1 px-4 py-2 rounded-lg border bg-background"
              />
              <Button>اشترك</Button>
            </div>
          </div>
        </div>
        
        <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
          <p>© 2024 متجر. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
