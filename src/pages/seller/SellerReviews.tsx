import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import SellerLayout from "@/components/seller/SellerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Star } from "lucide-react";

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  is_hidden: boolean;
  products: { name: string } | null;
  review_replies: { id: string; reply: string }[];
}

const Stars = ({ value }: { value: number }) => (
  <span className="inline-flex" aria-label={`${value} من 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`h-4 w-4 ${i <= value ? "fill-amber-400 text-warning" : "text-muted-foreground"}`} />
    ))}
  </span>
);

const SellerReviews = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reviews")
      .select("id,rating,comment,created_at,is_hidden,products!inner(name,vendor_id),review_replies(id,reply)")
      .eq("products.vendor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast({ title: "تعذّر تحميل التقييمات", description: error.message, variant: "destructive" });
    setRows((data as unknown as ReviewRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  const reply = async (r: ReviewRow) => {
    const text = (drafts[r.id] ?? "").trim();
    if (!text || !user) return;
    const existingId = r.review_replies?.[0]?.id;
    setSaving(r.id);
    const { error } = existingId
      ? await supabase.from("review_replies").update({ reply: text }).eq("id", existingId)
      : await supabase.from("review_replies").insert({ review_id: r.id, vendor_id: user.id, reply: text });
    setSaving(null);
    if (error) {
      toast({ title: "تعذّر إرسال الرد", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم إرسال الرد" });
    setDrafts((d) => { const c = { ...d }; delete c[r.id]; return c; });
    load();
  };

  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;

  return (
    <SellerLayout title="التقييمات" description={`متوسط تقييم منتجاتك: ${avg.toFixed(1)} من 5 (${rows.length} تقييم)`}>
      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">لا توجد تقييمات بعد.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const existing = r.review_replies?.[0]?.reply;
            return (
              <Card key={r.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Stars value={r.rating} />
                    <span className="text-sm font-medium">{r.products?.name}</span>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("ar-SY")}
                    </span>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  {existing && (
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <span className="font-semibold">ردّك: </span>{existing}
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Textarea
                      rows={2}
                      value={drafts[r.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                      placeholder={existing ? "تعديل الرد..." : "اكتب رداً مهنياً على التقييم..."}
                    />
                    <Button
                      className="sm:self-end"
                      disabled={!((drafts[r.id] ?? "").trim()) || saving === r.id}
                      onClick={() => reply(r)}
                    >
                      {saving === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : existing ? "تحديث" : "إرسال"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </SellerLayout>
  );
};

export default SellerReviews;
