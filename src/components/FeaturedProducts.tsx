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
    <section className="py-16">
      <div className="container px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">المنتجات المميزة</h2>
          <p className="text-muted-foreground text-lg">
            اختيارات خاصة لك من أحدث المنتجات
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product, index) => (
            <div
              key={index}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <ProductCard {...product} />
            </div>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <button className="text-primary hover:underline font-semibold text-lg">
            عرض المزيد من المنتجات
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
