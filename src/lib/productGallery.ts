/** Gallery order: the chosen color/variant picture first, then the product pictures, without repeats. */
export const galleryImages = (
  lead: string | null | undefined,
  images: string[] | null | undefined,
  mainImage: string | null | undefined,
): string[] => {
  const base = images && images.length > 0 ? images : mainImage ? [mainImage] : [];
  if (!lead) return base;
  return [lead, ...base.filter((u) => u !== lead)];
};
