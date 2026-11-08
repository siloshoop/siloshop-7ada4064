import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Loader2, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localDayRange, parseAdVisitors, type AdVisitorsResult } from "@/lib/adVisitors";

const PAGE = 50;
const num = (n: number) => n.toLocaleString("ar-SY");

interface Props {
  ad: { id: string; title: string } | null;
  onClose: () => void;
}

const AdVisitorsDialog = ({ ad, onClose }: Props) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<AdVisitorsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failure, setFailure] = useState("");
  const request = useRef(0);

  const fetchPage = useCallback(async (offset: number) => {
    if (!ad) return null;
    const range = localDayRange(from, to);
    const { data: raw, error } = await supabase.rpc("admin_home_carousel_ad_visitors", {
      p_ad_id: ad.id, p_from: range.from, p_to: range.to, p_limit: PAGE, p_offset: offset,
    });
    if (error) throw error;
    return parseAdVisitors(raw);
  }, [ad, from, to]);

  useEffect(() => {
    if (!ad) return;
    const current = ++request.current;
    if (from && to && from > to) { setData(null); setLoading(false); return; }
    setLoading(true);
    setFailure("");
    fetchPage(0)
      .then((result) => { if (current === request.current) setData(result); })
      .catch(() => { if (current === request.current) { setData(null); setFailure("تعذّر تحميل سجل الزوار؛ أعد المحاولة."); } })
      .finally(() => { if (current === request.current) setLoading(false); });
  }, [ad, fetchPage]);

  useEffect(() => { if (!ad) { setFrom(""); setTo(""); setData(null); } }, [ad]);

  const loadMore = async () => {
    if (!data) return;
    const current = request.current;
    setLoadingMore(true);
    try {
      const next = await fetchPage(data.visits.length);
      if (next && current === request.current) setData({ ...next, visits: [...data.visits, ...next.visits] });
    } catch {
      setFailure("تعذّر تحميل المزيد؛ أعد المحاولة.");
    } finally {
      setLoadingMore(false);
    }
  };

  const invalidRange = !!from && !!to && from > to;
  const s = data?.summary;

  return (
    <Dialog open={!!ad} onOpenChange={(value) => !value && onClose()}>
      <DialogContent dir="rtl" className="flex max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="text-right">
          <DialogTitle className="truncate">زوار إعلان «{ad?.title}»</DialogTitle>
          <DialogDescription>من شاهد هذا الإعلان في الصفحة الرئيسية، الأحدث أولًا.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="visitors-from" className="text-xs">من تاريخ</Label>
            <Input id="visitors-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="visitors-to" className="text-xs">إلى تاريخ</Label>
            <Input id="visitors-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <Button variant="ghost" size="sm" className="col-span-2 justify-self-start" onClick={() => { setFrom(""); setTo(""); }}>
              عرض كل التواريخ
            </Button>
          )}
        </div>
        {invalidRange && <p className="text-xs text-destructive">تاريخ البداية بعد تاريخ النهاية.</p>}

        {s && (
          <div className="grid grid-cols-2 gap-2" aria-live="polite">
            <div className="rounded-xl border border-border/60 bg-card p-3 shadow-card">
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" />إجمالي المشاهدات</p>
              <p className="mt-1 text-xl font-extrabold" data-testid="visitors-total">{num(s.total_views)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-3 shadow-card">
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />زوار فريدون</p>
              <p className="mt-1 text-xl font-extrabold" data-testid="visitors-unique">{num(s.unique_visitors)}</p>
              <p className="text-[0.6875rem] text-muted-foreground">{num(s.signed_in_visitors)} مسجّل · {num(s.guest_visitors)} ضيف</p>
            </div>
            {s.untracked_views > 0 && (
              <p className="col-span-2 text-[0.6875rem] text-muted-foreground">
                {num(s.untracked_views)} مشاهدة سُجّلت قبل تفعيل سجل الزوار، فهي محسوبة في الإجمالي دون تفاصيل الزائر.
              </p>
            )}
          </div>
        )}

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="جارٍ التحميل" /></div>
          ) : failure && !data ? (
            <p className="py-6 text-center text-sm text-destructive">{failure}</p>
          ) : data && data.visits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا توجد زيارات مسجّلة في هذه الفترة.</p>
          ) : data ? (
            <ul className="divide-y divide-border/60">
              {data.visits.map((v, i) => {
                const at = new Date(v.visited_at);
                const name = v.is_guest ? "زائر ضيف" : v.full_name || (v.account_missing ? "حساب محذوف" : "مستخدم بدون اسم");
                return (
                  <li key={`${v.visited_at}-${i}`} className="flex items-center gap-3 py-2.5">
                    <Avatar className="h-9 w-9">
                      {!v.is_guest && v.avatar_url && <AvatarImage src={v.avatar_url} alt="" />}
                      <AvatarFallback className={v.is_guest ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}>
                        {v.is_guest || !v.full_name ? <UserRound className="h-4 w-4" aria-hidden="true" /> : Array.from(v.full_name)[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${v.is_guest ? "text-muted-foreground" : ""}`}>{name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span>{at.toLocaleDateString("ar-SY", { year: "numeric", month: "long", day: "numeric" })}</span>
                        {" · "}
                        <span>{at.toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {failure && data && <p className="py-2 text-center text-xs text-destructive">{failure}</p>}
          {data?.has_more && !loading && (
            <div className="flex justify-center py-3">
              <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore && <Loader2 className="me-1 h-4 w-4 animate-spin" />}عرض المزيد
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdVisitorsDialog;
