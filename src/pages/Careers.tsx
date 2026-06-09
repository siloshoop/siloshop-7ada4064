import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, MapPin, Clock } from "lucide-react";
const Careers = () => {
  const jobs = [{
    title: "مطور واجهات أمامية",
    location: "دمشق",
    type: "دوام كامل",
    description: "نبحث عن مطور واجهات أمامية محترف يجيد React و TypeScript للانضمام إلى فريقنا المتنامي."
  }, {
    title: "مدير تسويق رقمي",
    location: "دمشق",
    type: "دوام كامل",
    description: "فرصة رائعة لمدير تسويق رقمي خبير في إدارة حملات التسويق الإلكتروني ووسائل التواصل الاجتماعي."
  }, {
    title: "مسؤول خدمة عملاء",
    location: "دمشق / عن بعد",
    type: "دوام كامل",
    description: "انضم إلى فريق خدمة العملاء لدينا وساعد في تقديم أفضل تجربة لعملائنا."
  }, {
    title: "مصمم UI/UX",
    location: "دمشق / عن بعد",
    type: "دوام جزئي",
    description: "نبحث عن مصمم مبدع لتصميم واجهات مستخدم جذابة وسهلة الاستخدام."
  }];
  return <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="bg-gradient-to-l from-primary/10 via-accent/10 to-primary/5 py-20">
          <div className="container px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">الوظائف</h1>
              <p className="text-lg text-muted-foreground">
                انضم إلى فريقنا وكن جزءاً من مستقبل التجارة الإلكترونية في سوريا
              </p>
            </div>
          </div>
        </div>

        <div className="container px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <div className="mb-12">
              <h2 className="text-3xl font-bold mb-4">لماذا العمل معنا؟</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">بيئة عمل مرنة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">نوفر خيارات العمل عن بعد والساعات المرنة</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">فرص النمو</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">برامج تدريب وتطوير مستمر لجميع الموظفين</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">رواتب تنافسية</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">حزمة تعويضات ومزايا شاملة ومنافسة</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold mb-6">الوظائف المتاحة</h2>
              <div className="space-y-4">
                {jobs.map((job, index) => <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <CardTitle className="text-xl">{job.title}</CardTitle>
                          <CardDescription>{job.description}</CardDescription>
                        </div>
                        <Button disabled>قريباً</Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{job.type}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-4 w-4" />
                          <span>خبرة: 2+ سنوات</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>)}
              </div>
            </div>

            <Card className="mt-12">
              <CardHeader>
                <CardTitle>لا تجد الوظيفة المناسبة؟</CardTitle>
                <CardDescription>أرسل لنا سيرتك الذاتية وسنتواصل معك عند توفر فرص مناسبة</CardDescription>
              </CardHeader>
              <CardContent>
                <Button disabled>قريباً</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>;
};
export default Careers;