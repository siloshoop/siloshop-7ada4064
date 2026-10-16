import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

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

  const target = ad.cta_url && ad.cta_url.startsWith("/") ? ad.cta_url : null;

  return (
    <aside aria-label={`إعلان من ${ad.sponsor_name}`} className={`container px-4 ${className}`}>
      <div
        role={target ? "link" : undefined}
        tabIndex={target ? 0 : undefined}
        onClick={target ? () => navigate(target) : undefined}
        onKeyDown={target ? (e) => { if (e.key === "Enter") navigate(target); } : undefined}
        className={`${target ? "cursor-pointer " : ""}overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)]`}>
        <div className="flex min-w-0 items-stretch">
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-3 text-right sm:gap-2 sm:p-4 md:p-5">
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary sm:text-xs">
              <Megaphone className="h-3 w-3" /> إعلان · {ad.sponsor_name}
            </span>
            <h2 className="line-clamp-2 text-sm font-bold leading-snug sm:text-lg">{ad.title}</h2>
            {ad.description && (
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">{ad.description}</p>
            )}
            {target && (
              <Button asChild size="sm" className="mt-0.5 h-8 w-fit gap-1 text-xs">
                <Link to={target} onClick={(e) => e.stopPropagation()}>
                  {ad.cta_text}
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>

          <div className="w-28 shrink-0 overflow-hidden bg-muted sm:w-44 md:w-56">
            <img
              src={!imageFailed && ad.image_url ? ad.image_url : "/placeholder.svg"}
              alt={ad.title}
              loading={placement === "home" ? "eager" : "lazy"}
              decoding="async"
              className="h-full max-h-40 min-h-24 w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default NativeAdBanner;