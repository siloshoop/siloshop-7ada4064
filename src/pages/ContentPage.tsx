import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Page {
  title: string;
  body: string;
  updated_at: string;
}

const ContentPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("content_pages")
        .select("title, body, updated_at")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      setPage((data as Page) ?? null);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (page?.title) document.title = `${page.title} | SiloShop`;
  }, [page?.title]);

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <Navbar />
      <main className="container flex-1 px-4 py-10">
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !page ? (
          <Card className="mx-auto max-w-xl">
            <CardContent className="space-y-4 py-14 text-center">
              <h1 className="text-xl font-bold">الصفحة غير متوفرة</h1>
              <p className="text-sm text-muted-foreground">قد تكون الصفحة غير منشورة أو تم حذفها.</p>
              <Button asChild><Link to="/">العودة للرئيسية</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <article className="mx-auto max-w-3xl">
            <h1 className="mb-2 text-3xl font-bold">{page.title}</h1>
            <p className="mb-6 text-xs text-muted-foreground">
              آخر تحديث: {new Date(page.updated_at).toLocaleDateString("ar")}
            </p>
            <div className="whitespace-pre-wrap leading-8 text-foreground/90">{page.body}</div>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default ContentPage;
