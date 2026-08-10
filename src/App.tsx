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
const Store = lazy(() => import("./pages/Store"));
const Subcategory = lazy(() => import("./pages/Subcategory"));
const ManageDeals = lazy(() => import("./pages/ManageDeals"));
const SearchPage = lazy(() => import("./pages/Search"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const SharedWishlist = lazy(() => import("./pages/SharedWishlist"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const FollowedBrands = lazy(() => import("./pages/FollowedBrands"));
const FollowedStores = lazy(() => import("./pages/FollowedStores"));
const ManageAnnouncements = lazy(() => import("./pages/ManageAnnouncements"));
const ManageUsers = lazy(() => import("./pages/ManageUsers"));
const ActivityLogs = lazy(() => import("./pages/ActivityLogs"));
const ShowroomManagement = lazy(() => import("./pages/admin/ShowroomManagement"));
const ShowroomAuditLog = lazy(() => import("./pages/admin/ShowroomAuditLog"));
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
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const ProductModeration = lazy(() => import("./pages/admin/ProductModeration"));
const ManageCategoriesAdmin = lazy(() => import("./pages/admin/ManageCategories"));
const ManageBrands = lazy(() => import("./pages/admin/ManageBrands"));
const ManageBanners = lazy(() => import("./pages/admin/ManageBanners"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminRevenue = lazy(() => import("./pages/admin/Revenue"));
const FeatureFlagsPage = lazy(() => import("./pages/admin/FeatureFlagsPage"));
const ShamCashSettings = lazy(() => import("./pages/admin/ShamCashSettings"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const GuestTrack = lazy(() => import("./pages/GuestTrack"));
import RequireRole from "@/components/RequireRole";
const RequireApprovedSeller = lazy(() => import("@/components/seller/RequireApprovedSeller"));
const SellerHome = lazy(() => import("./pages/seller/SellerHome"));
const SellerProducts = lazy(() => import("./pages/seller/SellerProducts"));
const SellerInventory = lazy(() => import("./pages/seller/SellerInventory"));
const SellerStockLog = lazy(() => import("./pages/seller/SellerStockLog"));
const SellerPerformance = lazy(() => import("./pages/seller/SellerPerformance"));
const SellerCustomers = lazy(() => import("./pages/seller/SellerCustomers"));
const SellerReviews = lazy(() => import("./pages/seller/SellerReviews"));
const SellerReports = lazy(() => import("./pages/seller/SellerReports"));
const SellerViolations = lazy(() => import("./pages/seller/SellerViolations"));
const AdminSellerViolations = lazy(() => import("./pages/admin/SellerViolations"));

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
            <Route path="/dashboard/add-product" element={<RequireApprovedSeller><AddProduct /></RequireApprovedSeller>} />
            <Route path="/dashboard/edit-product/:id" element={<RequireApprovedSeller><EditProduct /></RequireApprovedSeller>} />
            <Route path="/dashboard/coupons" element={<RequireApprovedSeller><ManageCoupons /></RequireApprovedSeller>} />
            <Route path="/dashboard/subcategories" element={<RequireRole role={["vendor","admin"]}><ManageSubcategories /></RequireRole>} />
            <Route path="/dashboard/statistics" element={<RequireApprovedSeller><Statistics /></RequireApprovedSeller>} />
            <Route path="/dashboard/orders" element={<RequireApprovedSeller><VendorOrders /></RequireApprovedSeller>} />
            <Route path="/dashboard/deals" element={<RequireApprovedSeller><ManageDeals /></RequireApprovedSeller>} />
            <Route path="/dashboard/announcements" element={<RequireRole role={["vendor","admin"]}><ManageAnnouncements /></RequireRole>} />
            <Route path="/dashboard/users" element={<RequireRole role="admin"><ManageUsers /></RequireRole>} />
            <Route path="/dashboard/activity-logs" element={<RequireRole role="admin"><ActivityLogs /></RequireRole>} />
            <Route path="/dashboard/showroom" element={<RequireRole role="super_admin"><ShowroomManagement /></RequireRole>} />
            <Route path="/dashboard/showroom/audit" element={<RequireRole role={["admin","super_admin"]}><ShowroomAuditLog /></RequireRole>} />
            <Route path="/dashboard/sellers" element={<RequireRole role="admin"><SellerManagement /></RequireRole>} />
            <Route path="/dashboard/platform-products" element={<RequireRole role="super_admin"><PlatformProducts /></RequireRole>} />
            <Route path="/dashboard/reports" element={<RequireRole role="admin"><Reports /></RequireRole>} />
            <Route path="/dashboard/admin-orders" element={<RequireRole role="admin"><AdminOrders /></RequireRole>} />
            <Route path="/dashboard/chat-moderation" element={<RequireRole role="admin"><ChatModeration /></RequireRole>} />
            <Route path="/dashboard/analytics" element={<RequireRole role="admin"><AdminAnalytics /></RequireRole>} />
            {/* Unified admin console */}
            <Route path="/admin" element={<RequireRole role="admin"><AdminHome /></RequireRole>} />
            <Route path="/admin/buyers" element={<RequireRole role="admin"><AdminUsers mode="buyers" /></RequireRole>} />
            <Route path="/admin/sellers" element={<RequireRole role="admin"><AdminUsers mode="sellers" /></RequireRole>} />
            <Route path="/admin/seller-applications" element={<RequireRole role="admin"><SellerManagement /></RequireRole>} />
            <Route path="/admin/products" element={<RequireRole role="admin"><ProductModeration /></RequireRole>} />
            <Route path="/admin/orders" element={<RequireRole role="admin"><AdminOrders /></RequireRole>} />
            <Route path="/admin/categories" element={<RequireRole role="admin"><ManageCategoriesAdmin /></RequireRole>} />
            <Route path="/admin/brands" element={<RequireRole role="admin"><ManageBrands /></RequireRole>} />
            <Route path="/admin/homepage" element={<RequireRole role={["admin","super_admin"]}><ShowroomManagement /></RequireRole>} />
            <Route path="/admin/banners" element={<RequireRole role="admin"><ManageBanners /></RequireRole>} />
            <Route path="/admin/reports" element={<RequireRole role="admin"><Reports /></RequireRole>} />
            <Route path="/admin/violations" element={<RequireRole role="admin"><AdminSellerViolations /></RequireRole>} />
            <Route path="/admin/chats" element={<RequireRole role="admin"><ChatModeration /></RequireRole>} />
            <Route path="/admin/notifications" element={<RequireRole role="admin"><AdminNotifications /></RequireRole>} />
            <Route path="/admin/statistics" element={<RequireRole role="admin"><AdminAnalytics /></RequireRole>} />
            <Route path="/admin/revenue" element={<RequireRole role="admin"><AdminRevenue /></RequireRole>} />
            <Route path="/admin/activity" element={<RequireRole role="admin"><ActivityLogs /></RequireRole>} />
            <Route path="/admin/features" element={<RequireRole role="super_admin"><FeatureFlagsPage /></RequireRole>} />
            <Route path="/admin/platform-products" element={<RequireRole role="super_admin"><PlatformProducts /></RequireRole>} />
            <Route path="/admin/sham-cash" element={<RequireRole role="super_admin"><ShamCashSettings /></RequireRole>} />
            <Route path="/seller/application" element={<SellerApplication />} />
            {/* Seller console (selling only, approved sellers) */}
            <Route path="/seller" element={<RequireApprovedSeller><SellerHome /></RequireApprovedSeller>} />
            <Route path="/seller/products" element={<RequireApprovedSeller><SellerProducts /></RequireApprovedSeller>} />
            <Route path="/seller/inventory" element={<RequireApprovedSeller><SellerInventory /></RequireApprovedSeller>} />
            <Route path="/seller/stock-log" element={<RequireApprovedSeller><SellerStockLog /></RequireApprovedSeller>} />
            <Route path="/seller/performance" element={<RequireApprovedSeller><SellerPerformance /></RequireApprovedSeller>} />
            <Route path="/seller/customers" element={<RequireApprovedSeller><SellerCustomers /></RequireApprovedSeller>} />
            <Route path="/seller/reviews" element={<RequireApprovedSeller><SellerReviews /></RequireApprovedSeller>} />
            <Route path="/seller/reports" element={<RequireApprovedSeller><SellerReports /></RequireApprovedSeller>} />
            <Route path="/seller/violations" element={<RequireApprovedSeller><SellerViolations /></RequireApprovedSeller>} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/wishlist" element={<Wishlist />} />
            <Route path="/wishlist/shared/:token" element={<SharedWishlist />} />
            <Route path="/category/:categoryId" element={<Category />} />
            <Route path="/subcategory/:categoryId/:subcategoryId" element={<Subcategory />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/track/:id" element={<TrackOrder />} />
            <Route path="/track" element={<GuestTrack />} />
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
            <Route path="/store/:vendorId" element={<Store />} />
            <Route path="/install" element={<InstallPWA />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/notifications/settings" element={<NotificationSettings />} />
            <Route path="/followed-brands" element={<FollowedBrands />} />
            <Route path="/followed-stores" element={<FollowedStores />} />
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