import AdminLayout from "@/components/admin/AdminLayout";
import FeatureFlagsManager from "@/components/admin/FeatureFlagsManager";

const FeatureFlagsPage = () => (
  <AdminLayout
    title="خصائص المنصة"
    description="تشغيل أو إيقاف الوحدات المستقبلية مثل منتجات المنصة ودفع شام كاش."
  >
    <FeatureFlagsManager />
  </AdminLayout>
);

export default FeatureFlagsPage;