import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const isAbsolute = (p: string) => /^https?:\/\//i.test(p);

/** Signed thumbnail for a file stored in the private `returns-media` bucket. */
const ReturnMedia = ({
  path,
  size = "h-20 w-20",
  alt = "صورة مرفقة بطلب الإرجاع",
}: {
  path: string;
  size?: string;
  alt?: string;
}) => {
  const [url, setUrl] = useState<string | null>(isAbsolute(path) ? path : null);

  useEffect(() => {
    if (isAbsolute(path)) {
      setUrl(path);
      return;
    }
    let alive = true;
    (async () => {
      const { data } = await supabase.storage.from("returns-media").createSignedUrl(path, 3600);
      if (alive) setUrl(data?.signedUrl ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [path]);

  if (!url) return <div className={`${size} animate-pulse rounded bg-muted`} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
      <img src={url} alt={alt} loading="lazy" className={`${size} rounded object-cover`} />
    </a>
  );
};

export default ReturnMedia;
