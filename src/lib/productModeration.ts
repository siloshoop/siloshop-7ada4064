export type ModerationStatus = "draft" | "pending" | "approved" | "rejected" | "hidden" | "archived";

export const MODERATION_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  hidden: "مخفي",
  archived: "مؤرشف",
};

export const MODERATION_BADGE_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/15 text-warning",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  hidden: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

export const moderationLabel = (s?: string | null) => MODERATION_LABELS[s ?? ""] ?? (s ?? "غير معروف");
export const moderationBadgeClass = (s?: string | null) =>
  MODERATION_BADGE_CLASS[s ?? ""] ?? "bg-muted text-muted-foreground";

export const LOW_STOCK_THRESHOLD = 5;
