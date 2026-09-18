import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export type NativeAdPlacement = "home" | "category" | "search" | "product";

interface NativeAd {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_text: string;
  cta_url: string | null;
  sponsor_name: string;
}

interface NativeAdBannerProps {
  placement: NativeAdPlacement;
  className?: string;
}

const NativeAdBanner = ({ placement, className = "" }: NativeAdBannerProps) => {
  const [ad, setAd] = useState<NativeAd | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const loadAd = useCallback(async () => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("native_ads")
      .select("id,title,description,image_url,cta_text,cta_url,sponsor_name")
      .eq("placement", placement)
      .eq("is_active", true)
      .or(`start_date.is.null,start_date.lte.${now}`)
      .or(`end_date.is.null,end_date.gt.${now}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Unable to load active ad:", error.message);
      setAd(null);
      return;
    }
    setAd(data);
    setImageFailed(false);
  }, [placement]);

  useEffect(() => {
    void loadAd();
    const channel = supabase
      .channel(`native-ads-${placement}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "native_ads" }, () => {
        void loadAd();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadAd, placement]);

  if (!ad) return null;

  return (
    <aside aria-label={`إعلان من ${ad.sponsor_name}`} className={`container px-4 ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
        <div className="grid min-w-0 md:grid-cols-[minmax(0,1fr)_minmax(280px,42%)] md:items-stretch">
          <div className="order-2 flex min-w-0 flex-col justify-center gap-3 p-5 text-right sm:p-6 md:order-1 md:p-8">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Megaphone className="h-3.5 w-3.5" /> إعلان · {ad.sponsor_name}
            </span>
            <h2 className="text-xl font-bold leading-snug sm:text-2xl">{ad.title}</h2>
            {ad.description && (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{ad.description}</p>
            )}
            {ad.cta_url && (
              <Button asChild className="mt-1 w-fit gap-1.5">
                <Link to={ad.cta_url}>
                  {ad.cta_text}
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          <div className="order-1 aspect-[16/9] min-h-0 overflow-hidden bg-muted md:order-2 md:aspect-auto md:min-h-56">
            <img
              src={!imageFailed && ad.image_url ? ad.image_url : "/placeholder.svg"}
              alt={ad.title}
              loading={placement === "home" ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default NativeAdBanner;