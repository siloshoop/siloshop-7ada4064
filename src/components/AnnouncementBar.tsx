import { useState, useEffect } from "react";
import { X, Percent, Gift, Truck, Tag, Sparkles, Zap, Star, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Announcement {
  id: string;
  text: string;
  icon: string;
}

const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
  percent: Percent,
  gift: Gift,
  truck: Truck,
  tag: Tag,
  sparkles: Sparkles,
  zap: Zap,
  star: Star,
  heart: Heart,
};

const AnnouncementBar = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, text, icon")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (announcements.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [announcements.length]);

  if (!isVisible || loading || announcements.length === 0) return null;

  const CurrentIcon = iconMap[announcements[currentIndex]?.icon] || Tag;

  return (
    <div className="relative bg-gradient-to-r from-primary via-primary/90 to-primary overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:20px_20px] animate-[slide_20s_linear_infinite]" />
      </div>
      
      <div className="container relative">
        <div className="flex items-center justify-center py-2.5 px-8">
          <div className="flex items-center gap-3 overflow-hidden">
            <CurrentIcon className="h-4 w-4 text-primary-foreground shrink-0 animate-pulse" />
            
            <div className="relative h-6 overflow-hidden">
              {announcements.map((announcement, index) => (
                <p
                  key={announcement.id}
                  className={`text-sm font-medium text-primary-foreground whitespace-nowrap absolute transition-all duration-500 ease-out ${
                    index === currentIndex
                      ? "translate-y-0 opacity-100"
                      : index < currentIndex
                      ? "-translate-y-full opacity-0"
                      : "translate-y-full opacity-0"
                  }`}
                >
                  {announcement.text}
                </p>
              ))}
            </div>
          </div>

          <button
            onClick={() => setIsVisible(false)}
            className="absolute left-4 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="إغلاق الإعلان"
          >
            <X className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
        <div
          className="h-full bg-white/60 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / announcements.length) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default AnnouncementBar;
