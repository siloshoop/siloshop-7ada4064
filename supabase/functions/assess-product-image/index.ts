// Assesses a product photo's clarity and listing suitability with Lovable AI.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "openai/gpt-6-astra";
const MAX_DATA_URL = 8 * 1024 * 1024;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "verdict", "clarity", "lighting", "background", "subject_visible", "issues", "suggestions", "summary"],
  properties: {
    score: { type: "integer", description: "0-100 overall suitability for a marketplace listing" },
    verdict: { type: "string", enum: ["excellent", "good", "needs_improvement", "unsuitable"] },
    clarity: { type: "string", enum: ["sharp", "acceptable", "blurry"] },
    lighting: { type: "string", enum: ["good", "acceptable", "poor"] },
    background: { type: "string", enum: ["clean", "acceptable", "cluttered"] },
    subject_visible: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
  },
};

const instructions = `أنت خبير تصوير منتجات لمتجر إلكتروني. قيّم صورة المنتج المرفقة من حيث: الوضوح والحدة، الإضاءة، نظافة الخلفية، ظهور المنتج بالكامل ومركزيته، ووجود نصوص/علامات مائية/عناصر مشتتة، ومدى ملاءمتها لعرض المنتج للبيع.
اكتب issues وsuggestions وsummary باللغة العربية بجمل قصيرة (حتى 4 عناصر لكل قائمة، والملخص جملة أو جملتان). إذا لم تكن الصورة لمنتج فاجعل verdict = unsuitable واذكر السبب.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return json({ error: "يجب تسجيل الدخول لاستخدام فحص الصور" }, 401);

  let image: string;
  try {
    const body = await req.json();
    image = String(body?.image ?? "");
  } catch {
    return json({ error: "طلب غير صالح" }, 400);
  }
  if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(image)) return json({ error: "صيغة الصورة غير مدعومة" }, 400);
  if (image.length > MAX_DATA_URL) return json({ error: "الصورة كبيرة جدًا للفحص" }, 413);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "خدمة الذكاء الاصطناعي غير مهيأة" }, 500);

  let upstream: Response;
  try {
    upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      signal: req.signal,
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        instructions,
        text: { format: { type: "json_schema", name: "image_assessment", strict: true, schema } },
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: "قيّم صورة المنتج هذه." },
              { type: "input_image", image_url: image },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    if (req.signal.aborted) return new Response(null, { status: 499, headers: corsHeaders });
    return json({ error: "تعذّر الاتصال بخدمة الذكاء الاصطناعي" }, 502);
  }

  if (!upstream.ok) {
    const details = await upstream.text();
    console.error(`AI gateway failed [${upstream.status}]: ${details}`);
    const msg =
      upstream.status === 429 ? "عدد كبير من الطلبات، حاول بعد قليل." :
      upstream.status === 402 ? "رصيد خدمة الذكاء الاصطناعي غير كافٍ حاليًا." :
      upstream.status === 403 ? "خدمة الذكاء الاصطناعي غير متاحة حاليًا." :
      "تعذّر فحص الصورة حاليًا.";
    return json({ error: msg, status: upstream.status }, upstream.status);
  }

  // Consume the SSE stream server-side and return the final JSON.
  const reader = upstream.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let failed: string | null = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const evt = JSON.parse(data);
        if (evt.type === "response.output_text.delta") text += evt.delta ?? "";
        else if (evt.type === "response.refusal.delta") failed = "رفض النموذج تقييم هذه الصورة.";
        else if (evt.type === "response.failed" || evt.type === "error") failed = "تعذّر فحص الصورة حاليًا.";
      } catch { /* partial */ }
    }
  }

  if (failed || !text.trim()) return json({ error: failed ?? "لم يُرجع النموذج نتيجة." }, 502);
  try {
    return json({ assessment: JSON.parse(text) });
  } catch {
    return json({ error: "نتيجة غير صالحة من النموذج." }, 502);
  }
});
