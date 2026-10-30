import { supabase } from "@/integrations/supabase/client";

const messages: Record<string, string> = {
  unauthorized: "انتهت جلسة الدخول؛ سجّل الدخول ثم أعد المحاولة.",
  invalid_password: "كلمة المرور غير صحيحة.",
  confirmation_required: "أدخل كلمة المرور واكتب «حذف» للتأكيد.",
  forbidden: "ليس لديك صلاحية حذف هذا المتجر.",
  staff_account: "حسابات الإدارة تحتاج إجراء حذف منفصلًا لحماية إدارة المنصة.",
  open_orders: "توجد طلبات أو مرتجعات أو مستحقات قيد التنفيذ؛ أكملها أو ألغها قبل الحذف.",
  retention_review_required: "يرتبط الحساب بسجلات طلبات أو مستحقات؛ يلزم اعتماد سياسة الاحتفاظ القانونية قبل حذفها. لم يبدأ الحذف.",
  store_not_found: "لا يوجد متجر مرتبط بهذا الحساب.",
  deletion_in_progress: "توجد عملية حذف غير مكتملة؛ أعد محاولة العملية نفسها لإكمالها.",
  storage_cleanup_failed: "تعذّر إكمال حذف الملفات. قد حُذفت بعض الملفات؛ أعد المحاولة لإكمال الحذف بأمان.",
  auth_delete_failed: "تم تنظيف بيانات الحساب، لكن تعذّر حذف تسجيل الدخول؛ أعد المحاولة لإكمال الحذف.",
  database_cleanup_failed: "تعذّر إكمال تنظيف البيانات؛ أعد المحاولة. لا يُعد الحذف مكتملًا بعد.",
  completion_failed: "تعذّر تأكيد المرحلة الأخيرة؛ أعد المحاولة أو اطلب مراجعة حالة الحذف.",
};

export async function requestSellerDeletion(scope: "store" | "account", password: string, confirmation: string, targetUserId?: string) {
  const { data, error } = await supabase.functions.invoke(`delete-own-${scope}`, {
    body: { password, confirmation, ...(targetUserId ? { target_user_id: targetUserId } : {}) },
  });
  let code = (data as { error?: string } | null)?.error;
  if (error) {
    // FunctionsHttpError contains a non-2xx Response, not the JSON in data.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.clone === "function") {
      const payload = await context.clone().json().catch(() => null);
      code = payload?.error ?? code;
    }
  }
  if (error || code || data?.success !== true) {
    throw new Error(messages[code ?? ""] ?? "تعذّر الاتصال لإكمال الحذف؛ تحقق من اتصالك وأعد المحاولة.");
  }
}