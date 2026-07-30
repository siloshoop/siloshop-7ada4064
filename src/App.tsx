import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { FlyToCartProvider } from "@/components/FlyToCart";
// Homepage stays eager (visibility-first per project error-isolation memory).
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy-loaded routes. Each becomes its own async chunk.
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AddProduct = lazy(() => import("./pages/AddProduct"));
const EditProduct = lazy(() => import("./pages/EditProduct"));
const Favorites = lazy(() => import("./pages/Favorites"));
const ManageCoupons = lazy(() => import("./pages/ManageCoupons"));
const ManageSubcategories = lazy(() => import("./pages/ManageSubcategories"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Category = lazy(() => import("./pages/Category"));
const Cart = lazy(() => import("./pages/Cart"));
const Orders = lazy(() => import("./pages/Orders"));
const Product = lazy(() => import("./pages/Product"));
const Chat = lazy(() => import("./pages/Chat"));
const Statistics = lazy(() => import("./pages/Statistics"));
const InstallPWA = lazy(() => import("./pages/InstallPWA"));
const Compare = lazy(() => import("./pages/Compare"));
const Contact = lazy(() => import("./pages/Contact"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Returns = lazy(() => import("./pages/Returns"));
const Shipping = lazy(() => import("./pages/Shipping"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Careers = lazy(() => import("./pages/Careers"));
const Partners = lazy(() => import("./pages/Partners"));
const VendorOrders = lazy(() => import("./pages/VendorOrders"));
const VendorRatings = lazy(() => import("./pages/VendorRatings"));
const Subcategory = lazy(() => import("./pages/Subcategory"));
const ManageDeals = lazy(() => import("./pages/ManageDeals"));
const SearchPage = lazy(() => import("./pages/Search"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const SharedWishlist = lazy(() => import("./pages/SharedWishlist"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const FollowedBrands = lazy(() => import("./pages/FollowedBrands"));
const ManageAnnouncements = lazy(() => import("./pages/ManageAnnouncements"));
const ManageUsers = lazy(() => import("./pages/ManageUsers"));
const ActivityLogs = lazy(() => import("./pages/ActivityLogs"));
const ManageNativeAds = lazy(() => import("./pages/ManageNativeAds"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Addresses = lazy(() => import("./pages/Addresses"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Pricing = lazy(() => import("./pages/Pricing"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const Messages = lazy(() => import("./pages/Messages"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const MyReturns = lazy(() => import("./pages/MyReturns"));
const VendorReturns = lazy(() => import("./pages/VendorReturns"));
const SellerApplication = lazy(() => import("./pages/SellerApplication"));
const SellerManagement = lazy(() => import("./pages/admin/SellerManagement"));
const PlatformProducts = lazy(() => import("./pages/admin/PlatformProducts"));
const Reports = lazy(() => import("./pages/admin/Reports"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const ChatModeration = lazy(() => import("./pages/admin/ChatModeration"));
const AdminAnalytics = lazy(() => import("./pages/admin/Analytics"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
import RequireRole from "@/components/RequireRole";

const queryClient = new QueryClient(); // App query client

const RouteFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-busy="true">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FlyToCartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/add-product" element={<RequireRole role="vendor"><AddProduct /></RequireRole>} />
            <Route path="/dashboard/edit-product/:id" element={<RequireRole role="vendor"><EditProduct /></RequireRole>} />
            <Route path="/dashboard/coupons" element={<RequireRole role="vendor"><ManageCoupons /></RequireRole>} />
            <Route path="/dashboard/subcategories" element={<RequireRole role={["vendor","admin"]}><ManageSubcategories /></RequireRole>} />
            <Route path="/dashboard/statistics" element={<RequireRole role="vendor"><Statistics /></RequireRole>} />
            <Route path="/dashboard/orders" element={<RequireRole role="vendor"><VendorOrders /></RequireRole>} />
            <Route path="/dashboard/deals" element={<RequireRole role="vendor"><ManageDeals /></RequireRole>} />
            <Route path="/dashboard/announcements" element={<RequireRole role={["vendor","admin"]}><ManageAnnouncements /></RequireRole>} />
            <Route path="/dashboard/users" element={<RequireRole role="admin"><ManageUsers /></RequireRole>} />
            <Route path="/dashboard/activity-logs" element={<RequireRole role="admin"><ActivityLogs /></RequireRole>} />
            <Route path="/dashboard/native-ads" element={<RequireRole role="admin"><ManageNativeAds /></RequireRole>} />
            <Route path="/dashboard/sellers" element={<RequireRole role="admin"><SellerManagement /></RequireRole>} />
            <Route path="/dashboard/platform-products" element={<RequireRole role="admin"><PlatformProducts /></RequireRole>} />
            <Route path="/dashboard/reports" element={<RequireRole role="admin"><Reports /></RequireRole>} />
            <Route path="/dashboard/admin-orders" element={<RequireRole role="admin"><AdminOrders /></RequireRole>} />
            <Route path="/dashboard/chat-moderation" element={<RequireRole role="admin"><ChatModeration /></RequireRole>} />
            <Route path="/dashboard/analytics" element={<RequireRole role="admin"><AdminAnalytics /></RequireRole>} />
            <Route path="/seller/application" element={<SellerApplication />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/wishlist/shared/:token" element={<SharedWishlist />} />
            <Route path="/category/:categoryId" element={<Category />} />
            <Route path="/subcategory/:categoryId/:subcategoryId" element={<Subcategory />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/track/:id" element={<TrackOrder />} />
            <Route path="/orders/:id" element={<OrderDetails />} />
            <Route path="/my-returns" element={<MyReturns />} />
            <Route path="/dashboard/returns" element={<RequireRole role={["vendor","admin"]}><VendorReturns /></RequireRole>} />
            <Route path="/account/addresses" element={<Addresses />} />
            <Route path="/product/:id" element={<Product />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/about" element={<About />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/chat/:vendorId" element={<Chat />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
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
          </Suspense>
        </BrowserRouter>
        </FlyToCartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;