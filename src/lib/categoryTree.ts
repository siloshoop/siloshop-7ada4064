export interface SubLike {
  id: string;
  name_ar: string;
  parent_subcategory_id?: string | null;
  sort_order?: number | null;
}

/** Flattens a category's subcategories into group → leaves order with full labels for pickers. */
export function flattenSubcategoryTree<T extends SubLike>(subs: T[]): Array<T & { label: string; depth: number }> {
  const by = (a: T, b: T) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
  const ids = new Set(subs.map((s) => s.id));
  const groups = subs.filter((s) => !s.parent_subcategory_id || !ids.has(s.parent_subcategory_id)).sort(by);
  const out: Array<T & { label: string; depth: number }> = [];
  for (const g of groups) {
    out.push({ ...g, label: g.name_ar, depth: 0 });
    for (const l of subs.filter((s) => s.parent_subcategory_id === g.id).sort(by)) {
      out.push({ ...l, label: `${g.name_ar} › ${l.name_ar}`, depth: 1 });
    }
  }
  return out;
}
