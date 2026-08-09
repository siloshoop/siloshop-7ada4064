import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

/**
 * Super-admin switchboard for Phase 2 features. Toggling a flag is the ONLY
 * step required to activate the Platform Marketplace or Sham Cash — the schema,
 * RLS policies and order logic are already in place.
 */
const FeatureFlagsManager = () => {
  const { rows, loading, reload } = useFeatureFlags();
  const [saving, setSaving] = useState<string | null>(null);

  const toggle = async (key: string, enabled: boolean) => {
    setSaving(key);
    const { error } = await supabase
      .from("feature_flags")
      .update({ enabled })
      .eq("key", key);
    setSaving(null);
    if (error) {
      toast({ title: "خطأ", description: "تعذر تحديث الخصائص", variant: "destructive" });
      return;
    }
    toast({ title: enabled ? "تم التفعيل" : "تم التعطيل" });
    await reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flag className="h-5 w-5 text-primary" /> خصائص المرحلة الثانية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          rows.map((f) => (
            <div
              key={f.key}
              className="flex items-start justify-between gap-4 rounded-lg border p-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{f.label_ar}</p>
                  <Badge variant={f.enabled ? "default" : "secondary"}>
                    {f.enabled ? "مُفعّل" : "قريبًا"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground" dir="ltr">{f.key}</p>
              </div>
              <Switch
                checked={f.enabled}
                disabled={saving === f.key}
                onCheckedChange={(v) => void toggle(f.key, v)}
                aria-label={f.label_ar}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default FeatureFlagsManager;
