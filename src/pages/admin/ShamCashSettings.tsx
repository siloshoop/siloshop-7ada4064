import AdminLayout from "@/components/admin/AdminLayout";
import ShamCashMerchantConfig from "@/components/admin/ShamCashMerchantConfig";
import PlatformShamCashSettings from "@/components/admin/PlatformShamCashSettings";

const ShamCashSettings = () => (
  <AdminLayout
    title="إعدادات شام كاش"
    description="بيانات حساب التاجر وبوابة الدفع الخاصة بمنتجات المنصة (غير مفعّلة حتى الآن)."
  >
    <div className="space-y-6">
      <ShamCashMerchantConfig />
      <PlatformShamCashSettings />
    </div>
  </AdminLayout>
);

export default ShamCashSettings;