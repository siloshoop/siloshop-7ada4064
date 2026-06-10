import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { FlyToCartProvider } from "@/components/FlyToCart";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AddProduct from "./pages/AddProduct";
import EditProduct from "./pages/EditProduct";
import Favorites from "./pages/Favorites";
import ManageCoupons from "./pages/ManageCoupons";
import ManageSubcategories from "./pages/ManageSubcategories";
import TrackOrder from "./pages/TrackOrder";
import Checkout from "./pages/Checkout";
import Category from "./pages/Category";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Product from "./pages/Product";
import NotFound from "./pages/NotFound";
import Chat from "./pages/Chat";
import Payment from "./pages/Payment";
import Statistics from "./pages/Statistics";
import InstallPWA from "./pages/InstallPWA";
import Compare from "./pages/Compare";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import Returns from "./pages/Returns";
import Shipping from "./pages/Shipping";
import About from "./pages/About";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Careers from "./pages/Careers";
import Partners from "./pages/Partners";
import VendorOrders from "./pages/VendorOrders";
import VendorRatings from "./pages/VendorRatings";
import Subcategory from "./pages/Subcategory";
import ManageDeals from "./pages/ManageDeals";
import SearchPage from "./pages/Search";
import Wishlist from "./pages/Wishlist";
import SharedWishlist from "./pages/SharedWishlist";
import Notifications from "./pages/Notifications";
import NotificationSettings from "./pages/NotificationSettings";
import FollowedBrands from "./pages/FollowedBrands";
import ManageAnnouncements from "./pages/ManageAnnouncements";
import ManageUsers from "./pages/ManageUsers";
import ActivityLogs from "./pages/ActivityLogs";
import ManageNativeAds from "./pages/ManageNativeAds";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Addresses from "./pages/Addresses";
import OrderDetails from "./pages/OrderDetails";
import Pricing from "./pages/Pricing";

const queryClient = new QueryClient(); // App query client

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FlyToCartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/add-product" element={<AddProduct />} />
            <Route path="/dashboard/edit-product/:id" element={<EditProduct />} />
            <Route path="/dashboard/coupons" element={<ManageCoupons />} />
            <Route path="/dashboard/subcategories" element={<ManageSubcategories />} />
            <Route path="/dashboard/statistics" element={<Statistics />} />
            <Route path="/dashboard/orders" element={<VendorOrders />} />
            <Route path="/dashboard/deals" element={<ManageDeals />} />
            <Route path="/dashboard/announcements" element={<ManageAnnouncements />} />
            <Route path="/dashboard/users" element={<ManageUsers />} />
            <Route path="/dashboard/activity-logs" element={<ActivityLogs />} />
            <Route path="/dashboard/native-ads" element={<ManageNativeAds />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/wishlist/shared/:token" element={<SharedWishlist />} />
            <Route path="/category/:categoryId" element={<Category />} />
            <Route path="/subcategory/:categoryId/:subcategoryId" element={<Subcategory />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/payment" element={<Payment />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/track/:id" element={<TrackOrder />} />
            <Route path="/orders/:id" element={<OrderDetails />} />
            <Route path="/account/addresses" element={<Addresses />} />
            <Route path="/product/:id" element={<Product />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/about" element={<About />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/chat/:vendorId" element={<Chat />} />
            <Route path="/vendor/:vendorId/ratings" element={<VendorRatings />} />
            <Route path="/install" element={<InstallPWA />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/notifications/settings" element={<NotificationSettings />} />
            <Route path="/followed-brands" element={<FollowedBrands />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </FlyToCartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;