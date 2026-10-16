// Merge saved tracking fields only; preserve financial and nested product data.
export function mergeSavedProductTracking<T extends { id: string }>(items: T[], update: Record<string, unknown>): T[] {
  return items.map((item) => {
    if (item.id !== update.id) return item;
    const saved = item as T & { tracking_updated_at?: string | null };
    const incoming = typeof update.tracking_updated_at === "string" ? Date.parse(update.tracking_updated_at) : NaN;
    const current = saved.tracking_updated_at ? Date.parse(saved.tracking_updated_at) : NaN;
    if (Number.isFinite(current) && (!Number.isFinite(incoming) || incoming < current)) return item;
    const fields = Object.fromEntries(
      ["tracking_status", "tracking_number", "shipping_carrier", "tracking_updated_at"]
        .filter((key) => Object.prototype.hasOwnProperty.call(update, key))
        .map((key) => [key, update[key]]),
    );
    return { ...item, ...fields };
  });
}