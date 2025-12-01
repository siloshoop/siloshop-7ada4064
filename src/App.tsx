import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AddProduct from "./pages/AddProduct";
import EditProduct from "./pages/EditProduct";
import Favorites from "./pages/Favorites";
import ManageCoupons from "./pages/ManageCoupons";
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
import Careers from "./pages/Careers";
import Partners from "./pages/Partners";
import VendorOrders from "./pages/VendorOrders";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/add-product" element={<AddProduct />} />
          <Route path="/dashboard/edit-product/:id" element={<EditProduct />} />
          <Route path="/dashboard/coupons" element={<ManageCoupons />} />
          <Route path="/dashboard/statistics" element={<Statistics />} />
          <Route path="/dashboard/orders" element={<VendorOrders />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/category/:categoryId" element={<Category />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/track/:id" element={<TrackOrder />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/returns" element={<Returns />} />
          <Route path="/shipping" element={<Shipping />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/chat/:vendorId" element={<Chat />} />
          <Route path="/install" element={<InstallPWA />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
