import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Users, Award, Heart } from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="bg-gradient-to-l from-primary/10 via-accent/10 to-primary/5 py-20">
          <div className="container px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">من نحن</h1>
              <p className="text-lg text-muted-foreground">
                نحن منصة التسوق الإلكتروني الرائدة في سوريا، نربط بين البائعين والمشترين في تجربة تسوق سلسة وآمنة
              </p>
            </div>
          </div>
        </div>

        <div className="container px-4 py-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Target className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">رؤيتنا</h3>
                  <p className="text-muted-foreground">أن نكون المنصة الأولى للتجارة الإلكترونية في سوريا</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <Users className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">مجتمعنا</h3>
                  <p className="text-muted-foreground">أكثر من 10,000 بائع ومئات الآلاف من العملاء</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <Award className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">جودتنا</h3>
                  <p className="text-muted-foreground">التزام بأعلى معايير الجودة في المنتجات والخدمات</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 text-center">
                  <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h3 className="font-bold text-xl mb-2">قيمنا</h3>
                  <p className="text-muted-foreground">الشفافية والثقة والابتكار في كل ما نقوم به</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold mb-6">قصتنا</h2>
                <div className="space-y-4 text-muted-foreground">
                  <p>
                    بدأنا رحلتنا في عام 2024 بهدف واضح: تسهيل التجارة الإلكترونية في سوريا وربط البائعين المحليين بالعملاء في جميع أنحاء البلاد.
                  </p>
                  <p>
                    نؤمن بأن التكنولوجيا يمكن أن تحدث فرقاً حقيقياً في حياة الناس، لذلك قمنا ببناء منصة سهلة الاستخدام وآمنة تلبي احتياجات السوق السورية.
                  </p>
                  <p>
                    اليوم، نفخر بكوننا جزءاً من رحلة آلاف التجار والمشترين، ونستمر في تطوير خدماتنا لتوفير أفضل تجربة تسوق إلكتروني ممكنة.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold mb-6">ما نقدمه</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xl">للبائعين</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• منصة سهلة لإدارة المنتجات والطلبات</li>
                      <li>• أدوات تسويقية متقدمة</li>
                      <li>• نظام دفع آمن وموثوق</li>
                      <li>• دعم فني متواصل</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xl">للمشترين</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• تشكيلة واسعة من المنتجات</li>
                      <li>• أسعار تنافسية وعروض حصرية</li>
                      <li>• توصيل سريع وآمن</li>
                      <li>• حماية كاملة للمشتريات</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold mb-6">التزامنا</h2>
                <p className="text-muted-foreground">
                  نلتزم بتوفير بيئة تجارية عادلة وشفافة للجميع. نحن نعمل باستمرار على تحسين خدماتنا والاستماع إلى 
                  ملاحظات مجتمعنا لنقدم أفضل تجربة ممكنة. رضاكم وثقتكم هما أولويتنا الأولى.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
