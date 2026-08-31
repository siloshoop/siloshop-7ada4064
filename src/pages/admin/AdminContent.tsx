import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Pencil, RefreshCw } from "lucide-react";

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

interface ContentPage {
  id: string;
  slug: string;
  title: string;
  body: string;
  is_published: boolean;
  updated_at: string;
}

export const FAQ_CATEGORIES = [
  { value: "orders", label: "الطلبات والشراء" },
  { value: "shipping", label: "الشحن والتوصيل" },
  { value: "account", label: "الحساب والأمان" },
  { value: "products", label: "المنتجات والأسعار" },
];

const emptyFaq = { category: "orders", question: "", answer: "", sort_order: 0, is_active: true };

const AdminContent = () => {
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [faqDraft, setFaqDraft] = useState<(typeof emptyFaq & { id?: string }) | null>(null);
  const [pageDraft, setPageDraft] = useState<Partial<ContentPage> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from("faq_items").select("*").order("category").order("sort_order"),
      supabase.from("content_pages").select("*").order("slug"),
    ]);
    setFaqs((f ?? []) as FaqItem[]);
    setPages((p ?? []) as ContentPage[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveFaq = async () => {
    if (!faqDraft) return;
    if (faqDraft.question.trim().length < 5 || faqDraft.answer.trim().length < 5) {
      toast({ title: "أكمل السؤال والجواب", variant: "destructive" });
      return;
    }
    setWorking(true);
    const payload = {
      category: faqDraft.category,
      question: faqDraft.question.trim(),
      answer: faqDraft.answer.trim(),
      sort_order: faqDraft.sort_order,
      is_active: faqDraft.is_active,
    };
    const { error } = faqDraft.id
      ? await supabase.from("faq_items").update(payload).eq("id", faqDraft.id)
      : await supabase.from("faq_items").insert(payload);
    setWorking(false);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حفظ السؤال" });
    setFaqDraft(null);
    void load();
  };

  const deleteFaq = async (id: string) => {
    const { error } = await supabase.from("faq_items").delete().eq("id", id);
    if (error) {
      toast({ title: "تعذر الحذف", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حذف السؤال" });
    void load();
  };

  const toggleFaq = async (row: FaqItem, next: boolean) => {
    const { error } = await supabase.from("faq_items").update({ is_active: next }).eq("id", row.id);
    if (error) {
      toast({ title: "تعذر التحديث", description: error.message, variant: "destructive" });
      return;
    }
    setFaqs((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)));
  };

  const savePage = async () => {
    if (!pageDraft) return;
    const slug = (pageDraft.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!slug || !(pageDraft.title ?? "").trim()) {
      toast({ title: "أكمل المعرّف والعنوان", variant: "destructive" });
      return;
    }
    setWorking(true);
    const payload = {
      slug,
      title: (pageDraft.title ?? "").trim(),
      body: pageDraft.body ?? "",
      is_published: pageDraft.is_published ?? true,
    };
    const { error } = pageDraft.id
      ? await supabase.from("content_pages").update(payload).eq("id", pageDraft.id)
      : await supabase.from("content_pages").insert(payload);
    setWorking(false);
    if (error) {
      toast({ title: "تعذر الحفظ", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "تم حفظ الصفحة" });
    setPageDraft(null);
    void load();
  };

  const deletePage = async (id: string) => {
    const { error } = await supabase.from("content_pages").delete().eq("id", id);
    if (error) {
      toast({ title: "تعذر الحذف", description: error.message, variant: "destructive" });
      return;
    }
    void load();
  };

  return (
    <AdminLayout
      title="إدارة المحتوى"
      description="الأسئلة الشائعة وصفحات السياسات — كل المحتوى يُقرأ من قاعدة البيانات"
      actions={
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="me-2 h-4 w-4" /> تحديث
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="faq">
          <TabsList className="mb-4">
            <TabsTrigger value="faq">الأسئلة الشائعة ({faqs.length})</TabsTrigger>
            <TabsTrigger value="pages">صفحات المحتوى ({pages.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="faq" className="space-y-3">
            <Button size="sm" onClick={() => setFaqDraft({ ...emptyFaq })}>
              <Plus className="me-2 h-4 w-4" /> سؤال جديد
            </Button>
            {FAQ_CATEGORIES.map((cat) => {
              const items = faqs.filter((f) => f.category === cat.value);
              if (items.length === 0) return null;
              return (
                <Card key={cat.value}>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{cat.label}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((f) => (
                      <div key={f.id} className="flex flex-wrap items-start gap-3 rounded-md border p-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{f.question}</p>
                          <p className="line-clamp-2 text-sm text-muted-foreground">{f.answer}</p>
                        </div>
                        <Switch checked={f.is_active} onCheckedChange={(v) => void toggleFaq(f, v)} aria-label="نشر" />
                        <Button size="icon" variant="ghost" onClick={() => setFaqDraft({ ...f })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => void deleteFaq(f.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
            {faqs.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                لا توجد أسئلة مضافة — تُعرض الأسئلة الافتراضية في صفحة المساعدة حتى تضيف أسئلتك
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="pages" className="space-y-3">
            <Button size="sm" onClick={() => setPageDraft({ slug: "", title: "", body: "", is_published: true })}>
              <Plus className="me-2 h-4 w-4" /> صفحة جديدة
            </Button>
            {pages.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.title}</span>
                      <Badge variant={p.is_published ? "secondary" : "outline"}>
                        {p.is_published ? "منشورة" : "مسودة"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">/{p.slug}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setPageDraft({ ...p })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => void deletePage(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {pages.length === 0 && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">لا توجد صفحات محتوى</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!faqDraft} onOpenChange={(o) => !o && setFaqDraft(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>{faqDraft?.id ? "تعديل سؤال" : "سؤال جديد"}</DialogTitle></DialogHeader>
          {faqDraft && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>القسم</Label>
                <Select value={faqDraft.category} onValueChange={(v) => setFaqDraft({ ...faqDraft, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FAQ_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>السؤال</Label>
                <Input value={faqDraft.question} maxLength={200}
                  onChange={(e) => setFaqDraft({ ...faqDraft, question: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>الجواب</Label>
                <Textarea value={faqDraft.answer} rows={5} maxLength={2000}
                  onChange={(e) => setFaqDraft({ ...faqDraft, answer: e.target.value })} />
              </div>
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label>الترتيب</Label>
                  <Input type="number" className="w-24" value={faqDraft.sort_order}
                    onChange={(e) => setFaqDraft({ ...faqDraft, sort_order: Number(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={faqDraft.is_active}
                    onCheckedChange={(v) => setFaqDraft({ ...faqDraft, is_active: v })} />
                  <span className="text-sm">منشور</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqDraft(null)}>إلغاء</Button>
            <Button disabled={working} onClick={() => void saveFaq()}>
              {working && <Loader2 className="me-2 h-4 w-4 animate-spin" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pageDraft} onOpenChange={(o) => !o && setPageDraft(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>{pageDraft?.id ? "تعديل صفحة" : "صفحة جديدة"}</DialogTitle></DialogHeader>
          {pageDraft && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>المعرّف (slug)</Label>
                <Input value={pageDraft.slug ?? ""} placeholder="privacy-policy"
                  onChange={(e) => setPageDraft({ ...pageDraft, slug: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>العنوان</Label>
                <Input value={pageDraft.title ?? ""} maxLength={150}
                  onChange={(e) => setPageDraft({ ...pageDraft, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>النص</Label>
                <Textarea rows={10} value={pageDraft.body ?? ""}
                  onChange={(e) => setPageDraft({ ...pageDraft, body: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={pageDraft.is_published ?? true}
                  onCheckedChange={(v) => setPageDraft({ ...pageDraft, is_published: v })} />
                <span className="text-sm">منشورة</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageDraft(null)}>إلغاء</Button>
            <Button disabled={working} onClick={() => void savePage()}>
              {working && <Loader2 className="me-2 h-4 w-4 animate-spin" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminContent;
