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

interface NewUserPayload {
  user_id: string;
  user_email: string;
  user_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, user_email, user_name }: NewUserPayload = await req.json();

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all admin users
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      throw new Error(`Failed to fetch admin roles: ${rolesError.message}`);
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admin users found to notify");
      return new Response(
        JSON.stringify({ message: "No admins to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get admin emails from auth.users
    const adminEmails: string[] = [];
    for (const admin of adminRoles) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(admin.user_id);
      if (!userError && userData?.user?.email) {
        adminEmails.push(userData.user.email);
      }
    }

    if (adminEmails.length === 0) {
      console.log("No admin emails found");
      return new Response(
        JSON.stringify({ message: "No admin emails found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const registrationDate = new Date().toLocaleDateString('ar-SY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Send email using Resend API directly via fetch
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Trendingsy <onboarding@resend.dev>",
        to: adminEmails,
        subject: "🆕 تسجيل مستخدم جديد في المنصة",
        html: `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 24px; }
              .content { padding: 30px; }
              .user-card { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-right: 4px solid #667eea; }
              .user-info { margin: 10px 0; }
              .label { color: #6c757d; font-size: 14px; }
              .value { color: #212529; font-size: 16px; font-weight: 600; margin-top: 4px; }
              .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>👤 مستخدم جديد</h1>
              </div>
              <div class="content">
                <p>مرحباً،</p>
                <p>تم تسجيل مستخدم جديد في منصة Trendingsy:</p>
                
                <div class="user-card">
                  <div class="user-info">
                    <div class="label">الاسم</div>
                    <div class="value">${esc(user_name || 'غير محدد')}</div>
                  </div>
                  <div class="user-info">
                    <div class="label">البريد الإلكتروني</div>
                    <div class="value">${esc(user_email)}</div>
                  </div>
                  <div class="user-info">
                    <div class="label">معرف المستخدم</div>
                    <div class="value" style="font-size: 12px; font-family: monospace;">${esc(user_id)}</div>
                  </div>
                  <div class="user-info">
                    <div class="label">تاريخ التسجيل</div>
                    <div class="value">${registrationDate}</div>
                  </div>
                </div>

                <p>يمكنك مراجعة بيانات المستخدم من لوحة التحكم.</p>
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

    const emailResult = await emailResponse.json();

    console.log("Admin notification emails sent successfully:", emailResult);

    // Also create in-app notifications for admins
    for (const admin of adminRoles) {
      await supabase.from("notifications").insert({
        user_id: admin.user_id,
        title: "مستخدم جديد",
        message: `تم تسجيل مستخدم جديد: ${user_name || user_email}`,
        type: "new_user",
        related_id: user_id,
      });
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent: adminEmails.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-admin-new-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
