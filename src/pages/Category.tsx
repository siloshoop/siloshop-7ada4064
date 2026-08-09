import { useEffect, useState, Fragment } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ProductGridSkeleton } from "@/components/skeletons/ProductSkeletons";
import ProductCard from "@/components/ProductCard";
import { SearchFilters } from "@/components/SearchFilters";
import { Loader2 } from "lucide-react";
interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  vendor_id: string;
  brand_id: string | null;
  stock_quantity: number | null;
  reviews: { rating: number }[];
}

interface VendorRating {
  vendor_id: string;
  avg_rating: number;
}

const Category = () => {
  const { categoryId } = useParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [vendorRatings, setVendorRatings] = useState<Map<string, number>>(new Map());
  const [salesMap, setSalesMap] = useState<Map<string, number>>(new Map());
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    minPrice: 0,
    maxPrice: 1000000,
    categoryId: "",
    sortBy: "newest",
    minVendorRating: 0,
    brandId: "",
    inStockOnly: false,
    minRating: 0,
  });

  useEffect(() => {
    if (categoryId) {
      fetchCategoryProducts();
    }
  }, [categoryId]);

  useEffect(() => {
    applyFilters();
  }, [products, filters, vendorRatings, salesMap]);

  const fetchCategoryProducts = async () => {
    // Fetch category info
    const { data: categoryData } = await supabase
      .from("categories")
      .select("name_ar")
      .eq("id", categoryId)
      .maybeSingle();

    if (categoryData) {
      setCategoryName(categoryData.name_ar);
    }

    // Fetch products
    const { data: productsData } = await supabase
      .from("products")
      .select(`
        id,
        name,
        price,
        original_price,
        image_url,
        vendor_id,
        brand_id,
        stock_quantity,
        shipping_cost,
        reviews(rating)
      `)
      .eq("category_id", categoryId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (productsData) {
      setProducts(productsData as any);
      
      // Fetch vendor ratings
      const vendorIds = [...new Set(productsData.map(p => p.vendor_id))];
      const { data: ratingsData } = await supabase
        .from("vendor_ratings")
        .select("vendor_id, rating")
        .in("vendor_id", vendorIds);
      
      if (ratingsData) {
        const ratingsMap = new Map<string, number[]>();
        ratingsData.forEach(r => {
          if (!ratingsMap.has(r.vendor_id)) {
            ratingsMap.set(r.vendor_id, []);
          }
          ratingsMap.get(r.vendor_id)!.push(r.rating);
        });
        
        const avgRatings = new Map<string, number>();
        ratingsMap.forEach((ratings, vendorId) => {
          avgRatings.set(vendorId, ratings.reduce((a, b) => a + b, 0) / ratings.length);
        });
        setVendorRatings(avgRatings);
      }

      // Fetch sales counts for "best selling" sort
      const productIds = productsData.map(p => p.id);
      if (productIds.length > 0) {
        const { data: salesData } = await supabase
          .from("order_items")
          .select("product_id, quantity")
          .in("product_id", productIds);
        if (salesData) {
          const sMap = new Map<string, number>();
          salesData.forEach((s: any) => {
            sMap.set(s.product_id, (sMap.get(s.product_id) || 0) + (s.quantity || 0));
          });
          setSalesMap(sMap);
        }
      }
    }
    setLoading(false);
  };

  const applyFilters = () => {
    let result = [...products];

    // Price filter
    result = result.filter(p => p.price >= filters.minPrice && p.price <= filters.maxPrice);

    // Vendor rating filter
    if (filters.minVendorRating > 0) {
      result = result.filter(p => {
        const vendorRating = vendorRatings.get(p.vendor_id) || 0;
        return vendorRating >= filters.minVendorRating;
      });
    }

    // Brand filter
    if (filters.brandId) {
      result = result.filter(p => p.brand_id === filters.brandId);
    }

    // Availability filter
    if (filters.inStockOnly) {
      result = result.filter(p => (p.stock_quantity ?? 0) > 0);
    }

    // Product rating filter
    if (filters.minRating > 0) {
      result = result.filter(p => {
        const avg = p.reviews?.length
          ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length
          : 0;
        return avg >= filters.minRating;
      });
    }

    // Sort
    switch (filters.sortBy) {
      case "price_asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "name_asc":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "rating_desc": {
        const avgOf = (p: Product) => p.reviews?.length ? p.reviews.reduce((s, r) => s + r.rating, 0) / p.reviews.length : 0;
        result.sort((a, b) => avgOf(b) - avgOf(a));
        break;
      }
      case "best_selling":
        result.sort((a, b) => (salesMap.get(b.id) || 0) - (salesMap.get(a.id) || 0));
        break;
    }

    setFilteredProducts(result);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-8">
          <ProductGridSkeleton count={12} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{categoryName || "الفئة"}</h1>
            <p className="text-muted-foreground">
              {filteredProducts.length} من {products.length} منتج
            </p>
          </div>
          <SearchFilters
            onFilterChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
          />
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {products.length === 0
                ? "لا توجد منتجات متاحة في هذه الفئة."
                : "لا توجد منتجات مطابقة للفلاتر"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product, index) => {
                const avgRating = product.reviews?.length > 0
                  ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
                  : 4;
                const discount = product.original_price
                  ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                  : undefined;
                return (
                  <Fragment key={product.id}>
                    <ProductCard
                      id={product.id}
                      name={product.name}
                      price={product.price}
                      originalPrice={product.original_price || undefined}
                      image={product.image_url}
                      rating={avgRating}
                      reviews={product.reviews?.length || 0}
                      discount={discount}
                      shippingCost={(product as any).shipping_cost || 0}
                    />
                  </Fragment>
                );
              })}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Category;

