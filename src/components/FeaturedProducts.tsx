import ProductCard from "./ProductCard";

const products = [
  {
    name: "فستان صيفي أنيق بأكمام قصيرة",
    price: 199,
    originalPrice: 299,
    image: "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=600&fit=crop",
    rating: 4.5,
    reviews: 128,
    discount: 33
  },
  {
    name: "قميص رجالي كلاسيكي قطن",
    price: 149,
    originalPrice: 249,
    image: "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=600&fit=crop",
    rating: 4.8,
    reviews: 95,
    discount: 40
  },
  {
    name: "حذاء رياضي عصري مريح",
    price: 399,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=600&fit=crop",
    rating: 4.7,
    reviews: 210
  },
  {
    name: "حقيبة يد جلدية فاخرة",
    price: 599,
    originalPrice: 899,
    image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&h=600&fit=crop",
    rating: 4.9,
    reviews: 87,
    discount: 33
  },
  {
    name: "ساعة يد ذكية رياضية",
    price: 799,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=600&fit=crop",
    rating: 4.6,
    reviews: 156
  },
  {
    name: "نظارة شمسية عصرية",
    price: 199,
    originalPrice: 349,
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=600&fit=crop",
    rating: 4.4,
    reviews: 73,
    discount: 43
  },
  {
    name: "جاكيت شتوي أنيق",
    price: 499,
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=600&fit=crop",
    rating: 4.8,
    reviews: 142
  },
  {
    name: "بنطال جينز كلاسيكي",
    price: 249,
    originalPrice: 349,
    image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=600&fit=crop",
    rating: 4.5,
    reviews: 198,
    discount: 29
  }
];

const FeaturedProducts = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-background to-muted/20">
      <div className="container px-4">
        <div className="text-center mb-16 space-y-3">
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-fade-in">
            المنتجات المميزة
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto">
            اختيارات خاصة لك من أحدث المنتجات وأفضل العروض
          </p>
          <div className="h-1 w-24 bg-gradient-to-r from-primary to-accent mx-auto rounded-full" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {products.map((product, index) => (
            <div
              key={index}
              className="animate-fade-in hover-scale"
              style={{ animationDelay: `${index * 75}ms` }}
            >
              <ProductCard {...product} />
            </div>
          ))}
        </div>
        
        <div className="text-center mt-16">
          <button className="group relative px-8 py-4 text-primary hover:text-primary-foreground font-bold text-lg border-2 border-primary rounded-full hover:bg-primary transition-all duration-300 shadow-lg hover:shadow-xl">
            <span className="relative z-10">عرض المزيد من المنتجات</span>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
