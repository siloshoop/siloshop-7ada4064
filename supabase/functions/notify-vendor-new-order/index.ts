import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = (Deno.env.get("RESEND_API_KEY") ?? "").trim().replace(/^["']|["']$/g, "");

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

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
}

interface NewOrderPayload {
  order_id: string;
  vendor_id: string;
  customer_name: string;
  items: OrderItem[];
  total_amount: number;
  shipping_address: string;
}

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

    const { order_id, vendor_id, customer_name, items, total_amount, shipping_address }: NewOrderPayload = await req.json();

    if (!order_id || !vendor_id) {
      return new Response(
        JSON.stringify({ error: "Invalid payload" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Service-role client for trusted lookups
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // --- Authorization: caller must own the order, AND vendor_id must
    // actually have an item in this order. Admins are also allowed. ---
    const [{ data: orderRow }, { data: vendorItem }, { data: isAdminRole }] = await Promise.all([
      supabase
        .from("orders")
        .select("customer_id")
        .eq("id", order_id)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select("id")
        .eq("order_id", order_id)
        .eq("vendor_id", vendor_id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    if (!orderRow || !vendorItem) {
      return new Response(
        JSON.stringify({ error: "Order or vendor mismatch" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const isOrderOwner = orderRow.customer_id === callerId;
    if (!isOrderOwner && !isAdminRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get vendor email
    const { data: vendorData, error: vendorError } = await supabase.auth.admin.getUserById(vendor_id);
    
    if (vendorError || !vendorData?.user?.email) {
      console.log("Could not find vendor email");
      return new Response(
        JSON.stringify({ message: "Vendor email not found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const vendorEmail = vendorData.user.email;

    // Get vendor profile for name
    const { data: vendorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", vendor_id)
      .single();

    const vendorName = vendorProfile?.full_name || "البائع";

    const orderDate = new Date().toLocaleDateString('ar-SY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Create items HTML
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${esc(item.product_name)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${esc(item.quantity)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: left;">${esc(item.price)} ل.س</td>
      </tr>
    `).join('');

    // Send email to vendor
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Trendingsy <onboarding@resend.dev>",
        to: [vendorEmail],
        subject: `🛒 طلب جديد #${order_id.slice(0, 8)}`,
        html: `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { padding: 30px; }
              .order-info { background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; border-right: 4px solid #10b981; }
              .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
              .label { color: #6c757d; }
              .value { font-weight: 600; color: #212529; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th { background-color: #f8f9fa; padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; }
              .total-row { background-color: #f0fdf4; font-weight: bold; }
              .total-row td { padding: 15px 12px; }
              .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; }
              .btn { display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 طلب جديد!</h1>
              </div>
              <div class="content">
                <p>مرحباً ${esc(vendorName)}،</p>
                <p>تهانينا! لديك طلب جديد على منصة Trendingsy:</p>
                
                <div class="order-info">
                  <div class="info-row">
                    <span class="label">رقم الطلب:</span>
                    <span class="value">#${esc(order_id.slice(0, 8))}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">اسم العميل:</span>
                    <span class="value">${esc(customer_name)}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">تاريخ الطلب:</span>
                    <span class="value">${orderDate}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">عنوان التوصيل:</span>
                    <span class="value">${esc(shipping_address || 'غير محدد')}</span>
                  </div>
                </div>

                <h3>تفاصيل المنتجات:</h3>
                <table>
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th style="text-align: center;">الكمية</th>
                      <th style="text-align: left;">السعر</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                    <tr class="total-row">
                      <td colspan="2">الإجمالي</td>
                      <td style="text-align: left;">${esc(total_amount)} ل.س</td>
                    </tr>
                  </tbody>
                </table>

                <p>يرجى تجهيز الطلب في أقرب وقت ممكن.</p>
              </div>
              <div class="footer">
                <p>هذه رسالة آلية من نظام Trendingsy</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResult = await emailResponse.json().catch(() => null);
    const emailSent = emailResponse.ok;
    if (emailSent) {
      console.log("Vendor notification email sent successfully:", emailResult);
    } else {
      // Never report a failed send as success — surface it so it can be diagnosed.
      console.error(
        `Vendor notification email FAILED (status ${emailResponse.status}):`,
        emailResult,
      );
    }

    // Also create in-app notification for vendor
    await supabase.from("notifications").insert({
      user_id: vendor_id,
      title: "طلب جديد",
      message: `لديك طلب جديد من ${customer_name} بقيمة ${total_amount} ل.س`,
      type: "new_order",
      related_id: order_id,
    });

    return new Response(
      JSON.stringify({ success: true, emailSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-vendor-new-order function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
