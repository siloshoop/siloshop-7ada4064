import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { supabase } from "@/integrations/supabase/client";

interface OrderTrackingMapProps {
  currentLat?: number | null;
  currentLng?: number | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}

/**
 * Mapbox is ~1.2 MB, so this component is imported lazily by TrackOrder
 * and only pulled over the network when a tracking map is actually shown.
 */
const OrderTrackingMap = ({
  currentLat,
  currentLng,
  deliveryLat,
  deliveryLng,
}: OrderTrackingMapProps) => {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;
    let cancelled = false;

    const initMap = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        if (error) throw error;
        if (cancelled || !container.current) return;

        mapboxgl.accessToken = data.token;

        map.current = new mapboxgl.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [currentLng || 46.6753, currentLat || 24.7136],
          zoom: 12,
        });

        map.current.addControl(new mapboxgl.NavigationControl());

        if (deliveryLat && deliveryLng) {
          new mapboxgl.Marker({ color: "#22c55e" })
            .setLngLat([deliveryLng, deliveryLat])
            .setPopup(new mapboxgl.Popup().setHTML("<p>وجهة التسليم</p>"))
            .addTo(map.current);
        }

        if (currentLat && currentLng) {
          new mapboxgl.Marker({ color: "#3b82f6" })
            .setLngLat([currentLng, currentLat])
            .setPopup(new mapboxgl.Popup().setHTML("<p>الموقع الحالي</p>"))
            .addTo(map.current);
        }
      } catch {
        /* map is a progressive enhancement — tracking steps still render */
      }
    };

    initMap();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [currentLat, currentLng, deliveryLat, deliveryLng]);

  return <div ref={container} className="w-full h-96 rounded-lg bg-muted" />;
};

export default OrderTrackingMap;