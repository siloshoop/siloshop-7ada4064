import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MobileBottomNav from "@/components/MobileBottomNav";
import PopularCategories from "@/components/PopularCategories";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

const Categories = () => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1 pb-[120px] md:pb-0 page-enter">
      <div className="container px-4 pt-6">
        <h1 className="text-2xl font-bold md:text-3xl">تصفّح الفئات</h1>
        <p className="mt-1 text-sm text-muted-foreground">اختر الفئة المناسبة لتصل إلى المنتجات بسرعة.</p>
      </div>
      <SectionErrorBoundary>
        <PopularCategories />
      </SectionErrorBoundary>
    </main>
    <Footer />
    <MobileBottomNav />
  </div>
);

export default Categories;