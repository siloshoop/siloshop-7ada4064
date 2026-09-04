import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface OrderStatusPayload {
  order_id: string;
  new_status: string;
  notes?: string;
}

const getStatusLabel = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: "قيد الانتظار",
    confirmed: "تم التأكيد",
    processing: "قيد المعالجة",
    shipped: "تم الشحن",
    out_for_delivery: "في الطريق للتوصيل",
    delivered: "تم التوصيل",
    cancelled: "ملغى",
  };
  return statusMap[status] || status;
};

const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    pending: "#f59e0b",
    confirmed: "#3b82f6",
    processing: "#8b5cf6",
    shipped: "#06b6d4",
    out_for_delivery: "#10b981",
    delivered: "#22c55e",
    cancelled: "#ef4444",
  };
  return colorMap[status] || "#6b7280";
};

const getStatusIcon = (status: string): string => {
  const iconMap: Record<string, string> = {
    pending: "⏳",
    confirmed: "✅",
    processing: "🔄",
    shipped: "📦",
    out_for_delivery: "🚚",
    delivered: "🎉",
    cancelled: "❌",
  };
  return iconMap[status] || "📋";
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Authentication: caller must be signed in ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const callerId = claimsData.claims.sub as string;

    const { order_id, new_status, notes }: OrderStatusPayload = await req.json();

    if (!order_id || !new_status) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Service-role client for cross-table reads/writes
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Authorization: caller must be admin OR a vendor with an item in this order ---
    const [{ data: isAdminRole }, { data: vendorItem }] = await Promise.all([
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle(),
      supabase
        .from("order_items")
        .select("id")
        .eq("order_id", order_id)
        .eq("vendor_id", callerId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (!isAdminRole && !vendorItem) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get order details with customer info
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        total_amount,
        shipping_address,
        customer_id,
        courier_name
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.log("Order not found:", orderError);
      return new Response(
        JSON.stringify({ message: "Order not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get customer profile
    const { data: customerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", order.customer_id)
      .single();

    // Get customer email
    const { data: customerData, error: customerError } = await supabase.auth.admin.getUserById(order.customer_id);
    
    if (customerError || !customerData?.user?.email) {
      console.log("Could not find customer email");
      return new Response(
        JSON.stringify({ message: "Customer email not found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const customerEmail = customerData.user.email;
    const customerName = customerProfile?.full_name || "العميل الكريم";
    const statusLabel = getStatusLabel(new_status);
    const statusColor = getStatusColor(new_status);
    const statusIcon = getStatusIcon(new_status);

    const updateDate = new Date().toLocaleDateString('ar-SY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Build tracking info section if available
    let trackingHtml = '';
    if (order.courier_name) {
      trackingHtml = `
        <div style="background-color: #f0f9ff; border-radius: 8px; padding: 15px; margin: 20px 0; border-right: 4px solid #0ea5e9;">
          <h4 style="margin: 0 0 10px 0; color: #0369a1;">معلومات الشحن</h4>
          ${order.courier_name ? `<p style="margin: 5px 0;"><strong>شركة الشحن:</strong> ${esc(order.courier_name)}</p>` : ''}
        </div>
      `;
    }

    // Build notes section if available
    let notesHtml = '';
    if (notes) {
      notesHtml = `
        <div style="background-color: #fefce8; border-radius: 8px; padding: 15px; margin: 20px 0; border-right: 4px solid #eab308;">
          <p style="margin: 0;"><strong>ملاحظات:</strong> ${esc(notes)}</p>
        </div>
      `;
    }

    // Send email to customer
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Trendingsy <onboarding@resend.dev>",
        to: [customerEmail],
        subject: `${statusIcon} تحديث حالة طلبك #${order_id.slice(0, 8)}`,
        html: `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); color: white; padding: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .status-icon { font-size: 48px; margin-bottom: 10px; }
              .content { padding: 30px; }
              .status-badge { display: inline-block; background-color: ${statusColor}20; color: ${statusColor}; padding: 8px 20px; border-radius: 20px; font-weight: 600; font-size: 16px; border: 2px solid ${statusColor}; }
              .order-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .info-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
              .info-row:last-child { border-bottom: none; }
              .label { color: #6c757d; }
              .value { font-weight: 600; color: #212529; }
              .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; }
              .btn { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="status-icon">${statusIcon}</div>
                <h1>تحديث حالة الطلب</h1>
              </div>
              <div class="content">
                <p>مرحباً ${esc(customerName)}،</p>
                <p>نود إعلامك بأن حالة طلبك قد تم تحديثها:</p>
                
                <div style="text-align: center; margin: 25px 0;">
                  <span class="status-badge">${statusLabel}</span>
                </div>

                <div class="order-info">
                  <div class="info-row">
                    <span class="label">رقم الطلب:</span>
                    <span class="value">#${esc(order_id.slice(0, 8))}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">تاريخ التحديث:</span>
                    <span class="value">${updateDate}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">قيمة الطلب:</span>
                    <span class="value">${esc(order.total_amount)} ل.س</span>
                  </div>
                  <div class="info-row">
                    <span class="label">عنوان التوصيل:</span>
                    <span class="value">${esc(order.shipping_address || 'غير محدد')}</span>
                  </div>
                </div>

                ${trackingHtml}
                ${notesHtml}

                ${new_status === 'delivered' ? `
                  <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; border: 2px solid #22c55e;">
                    <p style="font-size: 18px; color: #15803d; margin: 0;">🎉 شكراً لتسوقك معنا!</p>
                    <p style="color: #166534; margin: 10px 0 0 0;">نأمل أن تكون قد استمتعت بتجربة التسوق</p>
                  </div>
                ` : ''}

                ${new_status === 'cancelled' ? `
                  <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; border: 2px solid #ef4444;">
                    <p style="color: #991b1b; margin: 0;">إذا كان لديك أي استفسار حول إلغاء الطلب، يرجى التواصل معنا</p>
                  </div>
                ` : ''}
              </div>
              <div class="footer">
                <p>هذه رسالة آلية من نظام Trendingsy</p>
                <p>لا ترد على هذا البريد الإلكتروني</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Customer notification email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-customer-order-status function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
