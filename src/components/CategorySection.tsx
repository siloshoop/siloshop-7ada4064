import { Card } from "@/components/ui/card";

const categories = [
  {
    name: "ملابس نساء",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=400&fit=crop",
    count: "500+ منتج"
  },
  {
    name: "ملابس رجال",
    image: "https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=400&h=400&fit=crop",
    count: "400+ منتج"
  },
  {
    name: "أطفال",
    image: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=400&h=400&fit=crop",
    count: "300+ منتج"
  },
  {
    name: "إكسسوارات",
    image: "https://images.unsplash.com/photo-1492707892479-7bc8d5a4ee93?w=400&h=400&fit=crop",
    count: "250+ منتج"
  },
  {
    name: "أحذية",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop",
    count: "350+ منتج"
  },
  {
    name: "حقائب",
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&h=400&fit=crop",
    count: "200+ منتج"
  }
];

const CategorySection = () => {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">تسوق حسب الفئة</h2>
          <p className="text-muted-foreground text-lg">
            اكتشف مجموعاتنا المتنوعة
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category, index) => (
            <Card
              key={index}
              className="group cursor-pointer overflow-hidden border-0 shadow-sm hover:shadow-lg transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={category.image}
                  alt={category.name}
                  className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-0 right-0 left-0 p-4 text-white">
                  <h3 className="font-semibold text-lg mb-1">{category.name}</h3>
                  <p className="text-xs opacity-90">{category.count}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
