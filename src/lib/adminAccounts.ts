import { supabase } from "@/integrations/supabase/client";
export interface AdminAccount {
  id: string; full_name: string | null; phone: string | null; email: string | null;
  role: "customer" | "vendor"; account_status: string; status_reason: string | null;
  is_banned: boolean; created_at: string | null; application_id: string | null;
  store_name: string | null; owner_name: string | null; contact_phone: string | null;
  contact_email: string | null; city: string | null; governorate: string | null; address: string | null;
  store_status: string | null; rejection_reason: string | null; logo_url: string | null;
  products_count: number; orders_count: number;
}
export async function loadAdminAccounts(kind: string, search: string, offset: number) {
  const { data, error } = await supabase.rpc("admin_account_directory", { _kind: kind, _search: search, _offset: offset, _limit: 50 });
  if (error) throw error;
  return data as unknown as { rows: AdminAccount[]; total: number };
}