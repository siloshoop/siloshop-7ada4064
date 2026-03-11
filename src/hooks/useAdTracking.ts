import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const getSessionId = () => {
  let sessionId = sessionStorage.getItem("ad-session-id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("ad-session-id", sessionId);
  }
  return sessionId;
};

// Track which slots have been recorded this session to avoid duplicates
const trackedImpressions = new Set<string>();

export const useAdTracking = (adSlot: string) => {
  const ref = useRef<HTMLDivElement>(null);

  // Track impression when element is visible
  useEffect(() => {
    const el = ref.current;
    if (!el || trackedImpressions.has(adSlot)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !trackedImpressions.has(adSlot)) {
          trackedImpressions.add(adSlot);
          supabase.from("ad_analytics").insert({
            ad_slot: adSlot,
            event_type: "impression",
            session_id: getSessionId(),
            page_url: window.location.pathname,
          }).then(() => {});
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [adSlot]);

  // Track click
  const trackClick = useCallback(() => {
    supabase.from("ad_analytics").insert({
      ad_slot: adSlot,
      event_type: "click",
      session_id: getSessionId(),
      page_url: window.location.pathname,
    }).then(() => {});
  }, [adSlot]);

  return { ref, trackClick };
};