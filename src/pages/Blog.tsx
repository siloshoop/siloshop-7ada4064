import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User } from "lucide-react";

const Blog = () => {
  const posts = [
    {
      title: "نصائح للتسوق الآمن عبر الإنترنت",
      description: "دليل شامل لحماية نفسك أثناء التسوق الإلكتروني",
      date: "2024-01-15",
      author: "فريق SiloShop",
      image: "/placeholder.svg"
    },
    {
      title: "كيف تختار المنتج المناسب؟",
      description: "خطوات عملية لاتخاذ قرار شراء صحيح",
      date: "2024-01-10",
      author: "فريق SiloShop",
      image: "/placeholder.svg"
    },
    {
      title: "أحدث صيحات الموضة لهذا الموسم",
      description: "تعرف على أبرز اتجاهات الموضة والأناقة",
      date: "2024-01-05",
      author: "فريق SiloShop",
      image: "/placeholder.svg"
    },
    {
      title: "دليل البائعين الجدد",
      description: "كل ما تحتاج معرفته للبدء في البيع على منصتنا",
      date: "2024-01-01",
      author: "فريق SiloShop",
      image: "/placeholder.svg"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">المدونة</h1>
            <p className="text-muted-foreground text-lg">نصائح ومقالات مفيدة عن التسوق والتجارة الإلكترونية</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <img 
                  src={post.image} 
                  alt={post.title}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                <CardHeader>
                  <CardTitle className="text-xl">{post.title}</CardTitle>
                  <CardDescription>{post.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(post.date).toLocaleDateString('ar-SY')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{post.author}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
